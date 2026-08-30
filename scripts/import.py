#!/usr/bin/env python3
"""
import.py — パース済み JSON または tshark 生 JSON を PostgreSQL にインポート

使い方:
  python3 scripts/import.py <parsed.json> [--move] [--dry-run] [--update]

オプション:
  --move        取り込み後にファイルを data/imported/ へ移動
  --dry-run     実際には書き込まず件数のみ表示
  --update      既存レコードもフィールド更新 (プロトコル再分類などに使用)

環境変数:
  DATABASE_URL  PostgreSQL 接続文字列 (web/.env から自動読み込み)
  VPN_SUBNET    VPN クライアントのサブネット prefix (デフォルト: "10.")

例:
  python3 scripts/import.py data/raw/capture_20260408_parsed.json
  python3 scripts/import.py data/raw/capture_20260408.json --update
"""

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path


# ============================================================
# 定数
# ============================================================

DNS_TYPE_NAMES: dict[str, str] = {
    "1": "A", "2": "NS", "5": "CNAME", "6": "SOA",
    "12": "PTR", "15": "MX", "16": "TXT", "28": "AAAA",
    "33": "SRV", "65": "HTTPS", "255": "ANY",
}

# tshark の tls.record.version は 10進数で返ってくる
TLS_VERSION_NAMES: dict[str, str] = {
    "768":  "SSLv3",
    "769":  "TLSv1.0",
    "770":  "TLSv1.1",
    "771":  "TLSv1.2",
    "772":  "TLSv1.3",
}

# TLS ハンドシェイクタイプ
TLS_HANDSHAKE_TYPES: dict[str, str] = {
    "1":  "ClientHello",
    "2":  "ServerHello",
    "4":  "NewSessionTicket",
    "8":  "EncryptedExtensions",
    "11": "Certificate",
    "12": "ServerKeyExchange",
    "13": "CertificateRequest",
    "14": "ServerHelloDone",
    "15": "CertificateVerify",
    "16": "ClientKeyExchange",
    "20": "Finished",
}

# TLS 暗号スイート (IANA 番号 → 名前)
TLS_CIPHER_NAMES: dict[int, str] = {
    0x0035: "TLS_RSA_AES256_CBC_SHA",
    0x002F: "TLS_RSA_AES128_CBC_SHA",
    0x009C: "TLS_RSA_AES128_GCM_SHA256",
    0x009D: "TLS_RSA_AES256_GCM_SHA384",
    0xC009: "TLS_ECDHE_ECDSA_AES128_CBC_SHA",
    0xC00A: "TLS_ECDHE_ECDSA_AES256_CBC_SHA",
    0xC013: "TLS_ECDHE_RSA_AES128_CBC_SHA",
    0xC014: "TLS_ECDHE_RSA_AES256_CBC_SHA",
    0xC023: "TLS_ECDHE_ECDSA_AES128_CBC_SHA256",
    0xC027: "TLS_ECDHE_RSA_AES128_CBC_SHA256",
    0xC02B: "TLS_ECDHE_ECDSA_AES128_GCM_SHA256",
    0xC02C: "TLS_ECDHE_ECDSA_AES256_GCM_SHA384",
    0xC02F: "TLS_ECDHE_RSA_AES128_GCM_SHA256",
    0xC030: "TLS_ECDHE_RSA_AES256_GCM_SHA384",
    0xCCA8: "TLS_ECDHE_RSA_CHACHA20_POLY1305",
    0xCCA9: "TLS_ECDHE_ECDSA_CHACHA20_POLY1305",
    0x1301: "TLS_AES_128_GCM_SHA256",
    0x1302: "TLS_AES_256_GCM_SHA384",
    0x1303: "TLS_CHACHA20_POLY1305_SHA256",
}

# IP プロトコル番号 → トランスポートプロトコル名
IP_PROTO_NAMES: dict[int, str] = {
    1:   "ICMP",
    2:   "IGMP",
    6:   "TCP",
    17:  "UDP",
    41:  "IPv6",
    47:  "GRE",
    50:  "ESP",
    51:  "AH",
    58:  "ICMPv6",
    89:  "OSPF",
    132: "SCTP",
}

# TCP フラグビット → 名前 (重要度順)
TCP_FLAG_BITS: list[tuple[int, str]] = [
    (0x002, "SYN"),
    (0x010, "ACK"),
    (0x001, "FIN"),
    (0x004, "RST"),
    (0x008, "PSH"),
    (0x020, "URG"),
    (0x040, "ECE"),
    (0x080, "CWR"),
    (0x100, "NS"),
]

PORT_PROTOCOL: dict[int, str] = {
    21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP",
    53: "DNS", 67: "DHCP", 68: "DHCP", 80: "HTTP",
    110: "POP3", 123: "NTP", 143: "IMAP",
    443: "HTTPS", 465: "SMTPS", 587: "SMTP",
    993: "IMAPS", 995: "POP3S",
    3306: "MySQL", 3389: "RDP", 5432: "PostgreSQL",
    6379: "Redis", 8080: "HTTP", 8443: "HTTPS",
    51820: "WireGuard",
}

# QUIC フロー識別の UDP ポート
QUIC_PORTS = {443, 80}

# フロー結合の時間ウィンドウ [秒]
FLOW_WINDOW_SECS = 5.0


# ============================================================
# パス解決
# ============================================================
SCRIPT_DIR = Path(__file__).parent
REPO_DIR   = SCRIPT_DIR.parent


def resolve_database_url() -> str | None:
    env_vars: dict[str, str] = {}
    env_file = REPO_DIR / "web" / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            m = re.match(r'^(\w+)\s*=\s*"?([^"]+)"?', line)
            if m:
                env_vars[m.group(1)] = m.group(2).strip()

    url = (
        os.environ.get("DIRECT_URL")
        or env_vars.get("DIRECT_URL")
        or os.environ.get("DATABASE_URL")
        or env_vars.get("DATABASE_URL")
    )

    if url:
        url = re.sub(r'[?&](pgbouncer|connection_limit)=[^&]*', '', url)
        url = url.rstrip('?&')

    return url or None


# ============================================================
# プロトコル強化
# ============================================================

def enhance_protocol(
    raw_proto: str,
    src_port:  int | None,
    dst_port:  int | None,
    tls_sni:   str | None,
    dns_query: str | None,
    http_host: str | None,
    http_method: str | None,
) -> str:
    """
    tshark の protocol 列を可能な限り具体的なラベルに変換する。
    - tshark 4.x は _ws.col.protocol (lowercase) で返す
    - UNKNOWN / TCP / UDP は SNI・DNS・ポートから再分類
    """
    p = (raw_proto or "").strip().upper()

    KEEP_AS_IS = {
        "DNS", "HTTP", "HTTPS", "ICMP", "ARP", "SSH", "FTP", "SMTP",
        "QUIC", "NTP", "MDNS", "SSDP", "DHCP", "LLMNR", "IGMP",
        "ICMPV6", "IPV6", "HTTP/JSON", "HTTP/XML",
    }
    if p in KEEP_AS_IS:
        return p

    if tls_sni:
        if dst_port == 443 and p in ("UDP", "UNKNOWN", ""):
            return "QUIC"
        return "TLS"

    if dns_query:
        return "DNS"

    if http_host or http_method:
        return "HTTP"

    if p in ("TCP", "UDP", "UNKNOWN", ""):
        for port in (dst_port, src_port):
            if port and port in PORT_PROTOCOL:
                if port == 443 and p == "UDP":
                    return "QUIC"
                return PORT_PROTOCOL[port]

    if "QUIC" in p:
        return "QUIC"

    if p in ("TLS", "SSL", "TLSV1", "TLSV1.0", "TLSV1.1", "TLSV1.2", "TLSV1.3"):
        return "TLS"

    if any(k in p for k in ("SEGMENT", "REASSEMBLED", "CONTINUATION", "DATA")):
        return "TCP"

    return p if p else "UNKNOWN"


# ============================================================
# 方向判定
# ============================================================

def detect_direction(src_ip: str, dst_ip: str) -> str:
    subnet = os.environ.get("VPN_SUBNET", "10.")
    if src_ip.startswith(subnet):
        return "outbound"
    if dst_ip.startswith(subnet):
        return "inbound"
    return "unknown"


# ============================================================
# tshark 生 JSON の正規化
# ============================================================

def first(val: object) -> str | None:
    if isinstance(val, list):
        return val[0] if val else None
    if isinstance(val, str) and val:
        return val
    return None


def all_values(val: object) -> list[str]:
    if isinstance(val, list):
        return [v for v in val if v]
    if isinstance(val, str) and val:
        return [val]
    return []


def parse_tcp_flags(flags_raw: str | None) -> str | None:
    """TCP フラグ hex 文字列 → "SYN", "FIN,ACK" などの可読文字列に変換"""
    if not flags_raw:
        return None
    try:
        val = int(flags_raw, 16) if flags_raw.startswith("0x") else int(flags_raw)
        parts = [name for mask, name in TCP_FLAG_BITS if val & mask]
        return ",".join(parts) if parts else None
    except (ValueError, TypeError):
        return None


def parse_bool_flag(raw: str | None) -> bool | None:
    """tshark の 0/1 フラグ文字列を Python bool に変換"""
    if raw is None:
        return None
    try:
        return int(raw) != 0
    except (ValueError, TypeError):
        return None


def parse_tls_cipher(cipher_raw: str | None) -> str | None:
    if not cipher_raw:
        return None
    try:
        val = int(cipher_raw)
        return TLS_CIPHER_NAMES.get(val, f"0x{val:04X}")
    except (ValueError, TypeError):
        return None


def make_quic_flow_id(
    src_ip: str, dst_ip: str,
    src_port: int | None, dst_port: int | None,
    connection_id: str | None,
) -> str:
    """
    QUIC フロー識別子を生成する。
    - quic.connection_id が取得できた場合はそれを使う
    - それ以外は 5-tuple のハッシュ (双方向正規化済み)
    """
    if connection_id:
        return f"quic_cid_{connection_id[:16]}"

    # 双方向正規化: src/dst の小さい方を先に置く
    a = (src_ip, src_port or 0)
    b = (dst_ip, dst_port or 0)
    if a > b:
        a, b = b, a
    key = f"{a[0]}:{a[1]}-{b[0]}:{b[1]}"
    h = hashlib.md5(key.encode()).hexdigest()[:8]
    return f"quic_{h}"


def parse_frame(frame: dict, session_id: str | None = None) -> dict | None:
    """tshark フレーム 1件を正規化レコードに変換"""
    layers = frame.get("_source", {}).get("layers", {})

    def g(key: str) -> str | None:
        return first(layers.get(key))

    # タイムスタンプ
    ts_raw = g("frame.time_epoch")
    if not ts_raw:
        return None
    try:
        ts_float = float(ts_raw)
        # DB の TIMESTAMP 型は μs 精度だが tshark は ns 精度を持つ場合がある。
        # 既存データとの重複チェックが正しく機能するよう ms 精度に丸める。
        ts = datetime.fromtimestamp(round(ts_float, 3), tz=timezone.utc)
        timestamp = ts.isoformat()
    except (ValueError, OSError):
        return None

    # IP (IPv4 優先、なければ IPv6)
    src_ip = g("ip.src") or g("ipv6.src") or ""
    dst_ip = g("ip.dst") or g("ipv6.dst") or ""
    if not src_ip or not dst_ip:
        return None

    # ポート
    src_port: int | None = None
    dst_port: int | None = None
    for proto in ("tcp", "udp"):
        sp = g(f"{proto}.srcport")
        dp = g(f"{proto}.dstport")
        if sp:
            try: src_port = int(sp)
            except ValueError: pass
        if dp:
            try: dst_port = int(dp)
            except ValueError: pass

    # ──── 拡張フィールド v2/v3 ──────────────────────────────────────────────

    iface       = g("frame.interface_name")
    dns_query   = g("dns.qry.name")
    dns_type_raw = g("dns.qry.type")
    dns_type    = DNS_TYPE_NAMES.get(dns_type_raw or "", dns_type_raw) if dns_type_raw else None

    resp_parts: list[str] = (
        all_values(layers.get("dns.a")) +
        all_values(layers.get("dns.aaaa")) +
        all_values(layers.get("dns.cname"))
    )
    dns_resp = ",".join(dict.fromkeys(resp_parts)) or None

    tls_sni      = g("tls.handshake.extensions_server_name")
    tls_ver_raw  = g("tls.record.version")
    tls_version: str | None = None
    if tls_ver_raw:
        tls_version = TLS_VERSION_NAMES.get(tls_ver_raw, f"TLS(0x{int(tls_ver_raw or 0):04x})")
    tls_cipher    = parse_tls_cipher(g("tls.handshake.ciphersuite"))
    tls_hs_raw    = g("tls.handshake.type")
    tls_handshake = TLS_HANDSHAKE_TYPES.get(tls_hs_raw or "", tls_hs_raw) if tls_hs_raw else None

    http_host   = g("http.host")
    http_method = g("http.request.method")
    http_path   = g("http.request.uri")
    http_status: int | None = None
    if raw_status := g("http.response.code"):
        try: http_status = int(raw_status)
        except ValueError: pass

    # TCP フラグ文字列
    tcp_flags = parse_tcp_flags(g("tcp.flags"))

    # UDP 長
    udp_length: int | None = None
    if ul := g("udp.length"):
        try: udp_length = int(ul)
        except ValueError: pass

    # IP TTL
    ip_ttl: int | None = None
    if ttl := g("ip.ttl"):
        try: ip_ttl = int(ttl)
        except ValueError: pass

    # IP データグラム長
    ip_len: int | None = None
    if il := g("ip.len"):
        try: ip_len = int(il)
        except ValueError: pass

    # トランスポートプロトコル
    transport_proto: str | None = None
    if proto_num := g("ip.proto"):
        try:
            transport_proto = IP_PROTO_NAMES.get(int(proto_num))
        except ValueError:
            pass
    if not transport_proto:
        has_tcp = bool(g("tcp.srcport") or g("tcp.dstport"))
        has_udp = bool(g("udp.srcport") or g("udp.dstport"))
        if has_tcp:
            transport_proto = "TCP"
        elif has_udp:
            transport_proto = "UDP"

    # ──── 拡張フィールド v4 ──────────────────────────────────────────────────

    # TCP 個別フラグ (tshark から直接取得)
    tcp_syn = parse_bool_flag(g("tcp.flags.syn"))
    tcp_fin = parse_bool_flag(g("tcp.flags.fin"))
    tcp_rst = parse_bool_flag(g("tcp.flags.reset"))

    # tcpFlags 文字列からフォールバック (tshark バージョンによっては個別フラグが取れない)
    if tcp_syn is None and tcp_flags:
        tcp_syn = "SYN" in tcp_flags
    if tcp_fin is None and tcp_flags:
        tcp_fin = "FIN" in tcp_flags
    if tcp_rst is None and tcp_flags:
        tcp_rst = "RST" in tcp_flags

    # TLS セッション ID
    tls_session_id = g("tls.handshake.session_id")

    # QUIC 候補フラグ (UDP + port 443 or 80)
    is_quic_candidate = (
        transport_proto == "UDP" and
        dst_port in QUIC_PORTS
    ) or None  # None = 不明 / 非 UDP は保存しない

    # QUIC フロー ID (quic.connection_id がある場合はそれを優先)
    quic_conn_id = g("quic.connection_id")
    quic_flow_id: str | None = None
    if is_quic_candidate:
        quic_flow_id = make_quic_flow_id(src_ip, dst_ip, src_port, dst_port, quic_conn_id)

    # hostName = SNI > HTTP host > DNS クエリ
    host_name = tls_sni or http_host or dns_query

    # プロトコル分類
    raw_proto = g("_ws.col.protocol") or g("_ws.col.Protocol") or ""
    protocol  = enhance_protocol(
        raw_proto, src_port, dst_port,
        tls_sni, dns_query, http_host, http_method,
    )

    direction = detect_direction(src_ip, dst_ip)

    bytes_val: int | None = None
    if fl := g("frame.len"):
        try: bytes_val = int(fl)
        except ValueError: pass

    return {
        # コアフィールド
        "timestamp":        timestamp,
        "ts_float":         ts_float,      # 内部計算用 (DB には保存しない)
        "srcIp":            src_ip,
        "dstIp":            dst_ip,
        "srcPort":          src_port,
        "dstPort":          dst_port,
        "protocol":         protocol,
        "bytes":            bytes_val,
        "direction":        direction,
        "hostName":         host_name,
        "tlsSni":           tls_sni,
        "dnsQuery":         dns_query,
        "rawJson":          json.dumps(layers, ensure_ascii=False),
        # v2
        "iface":            iface,
        "dnsType":          dns_type,
        "dnsResp":          dns_resp,
        "tlsVersion":       tls_version,
        "httpMethod":       http_method,
        "httpPath":         http_path,
        # v3
        "transportProto":   transport_proto,
        "tcpFlags":         tcp_flags,
        "udpLength":        udp_length,
        "tlsCipher":        tls_cipher,
        "tlsHandshake":     tls_handshake,
        "httpStatus":       http_status,
        "ipTtl":            ip_ttl,
        "ipLen":            ip_len,
        "captureSession":   session_id,
        # v4
        "relativeTime":     None,          # post-processing で設定
        "tcpSyn":           tcp_syn,
        "tcpFin":           tcp_fin,
        "tcpRst":           tcp_rst,
        "isQuicCandidate":  is_quic_candidate,
        "quicFlowId":       quic_flow_id,
        "tlsSessionId":     tls_session_id,
        "flowId":           None,          # post-processing で設定
    }


def is_raw_tshark(data: list) -> bool:
    return bool(data and isinstance(data[0], dict) and "_source" in data[0])


# ============================================================
# Post-processing: relativeTime / flowId
# ============================================================

def assign_relative_time(records: list[dict]) -> None:
    """
    同一セッション内の最初のパケットを基準に relativeTime [秒] を設定する。
    ts_float が存在するレコードのみ対象。
    """
    ts_list = [r["ts_float"] for r in records if r.get("ts_float") is not None]
    if not ts_list:
        return
    min_ts = min(ts_list)
    for rec in records:
        if rec.get("ts_float") is not None:
            rec["relativeTime"] = round(rec["ts_float"] - min_ts, 4)


def assign_flow_ids(records: list[dict], session_id: str | None) -> None:
    """
    5 秒以内の同一 5-tuple を同一フローとしてまとめ、flowId を付与する。

    フローキー (双方向正規化):
      - 小さい IP を src、大きい IP を dst に揃える
      - dst_port (なければ src_port)
      - transport_proto

    アルゴリズム:
      1. タイムスタンプ順にソート
      2. フローキー別に「最後のパケット時刻」を管理
      3. 時間差 <= FLOW_WINDOW_SECS なら同一フロー継続、超えたら新規フロー
    """
    # タイムスタンプでソート (ts_float がなければ ISO 文字列で代替)
    def sort_key(r: dict) -> float:
        if r.get("ts_float") is not None:
            return r["ts_float"]
        try:
            return datetime.fromisoformat(r["timestamp"]).timestamp()
        except Exception:
            return 0.0

    sorted_records = sorted(records, key=sort_key)

    flow_map: dict[tuple, tuple[float, str]] = {}
    # key -> (last_ts_float, flow_id)
    flow_counter = 0
    prefix = session_id or "X"

    for rec in sorted_records:
        ts = rec.get("ts_float")
        if ts is None:
            try:
                ts = datetime.fromisoformat(rec["timestamp"]).timestamp()
            except Exception:
                ts = 0.0

        src, dst = rec["srcIp"], rec["dstIp"]
        sport, dport = rec.get("srcPort") or 0, rec.get("dstPort") or 0
        proto = rec.get("transportProto") or ""

        # 双方向正規化
        if (src, sport) > (dst, dport):
            src, dst = dst, src
            sport, dport = dport, sport

        flow_key = (src, dst, dport, proto)

        if flow_key in flow_map:
            last_ts, fid = flow_map[flow_key]
            if ts - last_ts <= FLOW_WINDOW_SECS:
                rec["flowId"] = fid
                flow_map[flow_key] = (ts, fid)
                continue

        # 新規フロー
        fid = f"{prefix}_f{flow_counter:05d}"
        flow_counter += 1
        flow_map[flow_key] = (ts, fid)
        rec["flowId"] = fid


# ============================================================
# PostgreSQL への取り込み
# ============================================================

# DB に保存するフィールド名 (ts_float は内部計算専用のため除外)
DB_FIELDS = [
    "timestamp", "srcIp", "dstIp", "srcPort", "dstPort",
    "protocol", "bytes", "direction", "hostName", "tlsSni", "dnsQuery",
    "rawJson",
    "iface", "dnsType", "dnsResp", "tlsVersion", "httpMethod", "httpPath",
    "transportProto", "tcpFlags", "udpLength", "tlsCipher", "tlsHandshake",
    "httpStatus", "ipTtl", "ipLen", "captureSession",
    # v4
    "relativeTime", "tcpSyn", "tcpFin", "tcpRst",
    "isQuicCandidate", "quicFlowId", "tlsSessionId", "flowId",
]

# INSERT の VALUES に対応するプレースホルダー数
_QUOTED = {
    "srcIp", "dstIp", "srcPort", "dstPort",
    "rawJson", "hostName", "tlsSni", "dnsQuery",
    "dnsType", "dnsResp", "tlsVersion", "httpMethod", "httpPath",
    "transportProto", "tcpFlags", "udpLength", "tlsCipher", "tlsHandshake",
    "httpStatus", "ipTtl", "ipLen", "captureSession",
    "relativeTime", "tcpSyn", "tcpFin", "tcpRst",
    "isQuicCandidate", "quicFlowId", "tlsSessionId", "flowId",
}


def import_to_postgres(
    records:   list[dict],
    db_url:    str,
    dry_run:   bool = False,
    do_update: bool = False,
) -> tuple[int, int, int]:
    """
    records を Packet テーブルに挿入 / 更新する。
    重複チェック: (timestamp, srcIp, dstIp, srcPort, dstPort) の一致で判定。
    """
    if dry_run:
        print(f"[dry-run] {len(records)} 件 (実際には書き込みません)")
        return 0, 0, len(records)

    try:
        import psycopg2
    except ImportError:
        print("[error] psycopg2 が見つかりません:", file=sys.stderr)
        print("  sudo apt install -y python3-psycopg2", file=sys.stderr)
        sys.exit(1)

    con = psycopg2.connect(db_url)
    cur = con.cursor()

    cur.execute(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'packets')"
    )
    if not cur.fetchone()[0]:
        print("[error] packets テーブルが存在しません", file=sys.stderr)
        con.close()
        sys.exit(1)

    # v4 カラムが存在するか確認（古い DB でもエラーにならないよう対応）
    cur.execute(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'packets'
          AND column_name IN ('relativeTime','tcpSyn','tcpFin','tcpRst',
                              'isQuicCandidate','quicFlowId','tlsSessionId','flowId')
        """
    )
    existing_v4 = {row[0] for row in cur.fetchall()}
    has_v4 = len(existing_v4) == 8
    if not has_v4:
        missing = {"relativeTime","tcpSyn","tcpFin","tcpRst",
                   "isQuicCandidate","quicFlowId","tlsSessionId","flowId"} - existing_v4
        print(f"[import] 警告: v4 カラムが未設定です: {missing}")
        print("[import]   → scripts/migrate_v4.sql を実行してください")

    inserted = updated = skipped = 0
    now = datetime.now(timezone.utc).isoformat()

    for rec in records:
        cur.execute(
            """
            SELECT id FROM packets
            WHERE timestamp = %s
              AND "srcIp"   = %s
              AND "dstIp"   = %s
              AND "srcPort" IS NOT DISTINCT FROM %s
              AND "dstPort" IS NOT DISTINCT FROM %s
            LIMIT 1
            """,
            (rec["timestamp"], rec["srcIp"], rec["dstIp"],
             rec.get("srcPort"), rec.get("dstPort")),
        )
        row = cur.fetchone()

        if row:
            if do_update:
                # v4 カラムがある場合のみ追加 UPDATE
                v4_set = ""
                v4_vals: list = []
                if has_v4:
                    v4_set = """
                      "relativeTime"    = COALESCE("relativeTime",    %s),
                      "tcpSyn"          = COALESCE("tcpSyn",          %s),
                      "tcpFin"          = COALESCE("tcpFin",          %s),
                      "tcpRst"          = COALESCE("tcpRst",          %s),
                      "isQuicCandidate" = COALESCE("isQuicCandidate", %s),
                      "quicFlowId"      = COALESCE("quicFlowId",      %s),
                      "tlsSessionId"    = COALESCE("tlsSessionId",    %s),
                      "flowId"          = COALESCE("flowId",          %s),"""
                    v4_vals = [
                        rec.get("relativeTime"),  rec.get("tcpSyn"),
                        rec.get("tcpFin"),        rec.get("tcpRst"),
                        rec.get("isQuicCandidate"), rec.get("quicFlowId"),
                        rec.get("tlsSessionId"),  rec.get("flowId"),
                    ]

                cur.execute(
                    f"""
                    UPDATE packets SET
                      protocol   = %s,
                      "hostName" = %s,
                      "tlsSni"   = %s,
                      "dnsQuery" = %s,
                      direction  = %s,
                      iface           = COALESCE(iface,           %s),
                      "dnsType"       = COALESCE("dnsType",       %s),
                      "dnsResp"       = COALESCE("dnsResp",       %s),
                      "tlsVersion"    = COALESCE("tlsVersion",    %s),
                      "httpMethod"    = COALESCE("httpMethod",    %s),
                      "httpPath"      = COALESCE("httpPath",      %s),
                      "transportProto"= COALESCE("transportProto",%s),
                      "tcpFlags"      = COALESCE("tcpFlags",      %s),
                      "udpLength"     = COALESCE("udpLength",     %s),
                      "tlsCipher"     = COALESCE("tlsCipher",     %s),
                      "tlsHandshake"  = COALESCE("tlsHandshake",  %s),
                      "httpStatus"    = COALESCE("httpStatus",    %s),
                      "ipTtl"         = COALESCE("ipTtl",         %s),
                      "ipLen"         = COALESCE("ipLen",         %s),
                      "captureSession"= COALESCE("captureSession",%s),
                      {v4_set}
                      "updatedAt" = %s
                    WHERE id = %s
                    """,
                    (
                        rec["protocol"], rec.get("hostName"), rec.get("tlsSni"),
                        rec.get("dnsQuery"), rec.get("direction"),
                        rec.get("iface"),           rec.get("dnsType"),
                        rec.get("dnsResp"),          rec.get("tlsVersion"),
                        rec.get("httpMethod"),       rec.get("httpPath"),
                        rec.get("transportProto"),   rec.get("tcpFlags"),
                        rec.get("udpLength"),        rec.get("tlsCipher"),
                        rec.get("tlsHandshake"),     rec.get("httpStatus"),
                        rec.get("ipTtl"),            rec.get("ipLen"),
                        rec.get("captureSession"),
                        *v4_vals,
                        now, row[0],
                    ),
                )
                updated += 1
            else:
                skipped += 1
            continue

        # ── 新規 INSERT ────────────────────────────────────────────────────
        if has_v4:
            cur.execute(
                """
                INSERT INTO packets
                  (id, timestamp, "srcIp", "dstIp", "srcPort", "dstPort",
                   protocol, bytes, direction, "hostName", "tlsSni", "dnsQuery",
                   "rawJson", "createdAt", "updatedAt",
                   iface, "dnsType", "dnsResp", "tlsVersion", "httpMethod", "httpPath",
                   "transportProto", "tcpFlags", "udpLength", "tlsCipher", "tlsHandshake",
                   "httpStatus", "ipTtl", "ipLen", "captureSession",
                   "relativeTime", "tcpSyn", "tcpFin", "tcpRst",
                   "isQuicCandidate", "quicFlowId", "tlsSessionId", "flowId")
                VALUES
                  (gen_random_uuid()::text, %s, %s, %s, %s, %s,
                   %s, %s, %s, %s, %s, %s,
                   %s, %s, %s,
                   %s, %s, %s, %s, %s, %s,
                   %s, %s, %s, %s, %s,
                   %s, %s, %s, %s,
                   %s, %s, %s, %s,
                   %s, %s, %s, %s)
                """,
                (
                    rec["timestamp"], rec["srcIp"], rec["dstIp"],
                    rec.get("srcPort"), rec.get("dstPort"),
                    rec["protocol"], rec.get("bytes"), rec.get("direction"),
                    rec.get("hostName"), rec.get("tlsSni"), rec.get("dnsQuery"),
                    rec.get("rawJson"), now, now,
                    rec.get("iface"),           rec.get("dnsType"),
                    rec.get("dnsResp"),          rec.get("tlsVersion"),
                    rec.get("httpMethod"),       rec.get("httpPath"),
                    rec.get("transportProto"),   rec.get("tcpFlags"),
                    rec.get("udpLength"),        rec.get("tlsCipher"),
                    rec.get("tlsHandshake"),     rec.get("httpStatus"),
                    rec.get("ipTtl"),            rec.get("ipLen"),
                    rec.get("captureSession"),
                    rec.get("relativeTime"),     rec.get("tcpSyn"),
                    rec.get("tcpFin"),           rec.get("tcpRst"),
                    rec.get("isQuicCandidate"),  rec.get("quicFlowId"),
                    rec.get("tlsSessionId"),     rec.get("flowId"),
                ),
            )
        else:
            # v4 カラムなし (旧 DB 互換)
            cur.execute(
                """
                INSERT INTO packets
                  (id, timestamp, "srcIp", "dstIp", "srcPort", "dstPort",
                   protocol, bytes, direction, "hostName", "tlsSni", "dnsQuery",
                   "rawJson", "createdAt", "updatedAt",
                   iface, "dnsType", "dnsResp", "tlsVersion", "httpMethod", "httpPath",
                   "transportProto", "tcpFlags", "udpLength", "tlsCipher", "tlsHandshake",
                   "httpStatus", "ipTtl", "ipLen", "captureSession")
                VALUES
                  (gen_random_uuid()::text, %s, %s, %s, %s, %s,
                   %s, %s, %s, %s, %s, %s,
                   %s, %s, %s,
                   %s, %s, %s, %s, %s, %s,
                   %s, %s, %s, %s, %s,
                   %s, %s, %s, %s)
                """,
                (
                    rec["timestamp"], rec["srcIp"], rec["dstIp"],
                    rec.get("srcPort"), rec.get("dstPort"),
                    rec["protocol"], rec.get("bytes"), rec.get("direction"),
                    rec.get("hostName"), rec.get("tlsSni"), rec.get("dnsQuery"),
                    rec.get("rawJson"), now, now,
                    rec.get("iface"),           rec.get("dnsType"),
                    rec.get("dnsResp"),          rec.get("tlsVersion"),
                    rec.get("httpMethod"),       rec.get("httpPath"),
                    rec.get("transportProto"),   rec.get("tcpFlags"),
                    rec.get("udpLength"),        rec.get("tlsCipher"),
                    rec.get("tlsHandshake"),     rec.get("httpStatus"),
                    rec.get("ipTtl"),            rec.get("ipLen"),
                    rec.get("captureSession"),
                ),
            )
        inserted += 1

    con.commit()
    con.close()
    return inserted, updated, skipped


# ============================================================
# メイン
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="NetScope JSON インポーター (PostgreSQL)")
    parser.add_argument("input",      help="入力 JSON ファイル")
    parser.add_argument("--move",     action="store_true", help="インポート後にファイルを data/imported/ へ移動")
    parser.add_argument("--dry-run",  action="store_true", help="書き込まず件数のみ表示")
    parser.add_argument("--update",   action="store_true", help="既存レコードもフィールド更新 (プロトコル再分類)")
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    if not input_path.exists():
        print(f"[error] ファイルが見つかりません: {input_path}", file=sys.stderr)
        sys.exit(1)

    db_url = resolve_database_url()
    if not db_url:
        print("[error] DATABASE_URL が設定されていません", file=sys.stderr)
        sys.exit(1)

    print(f"[import] 入力: {input_path.name}")
    print(f"[import] DB  : {db_url[:40]}...")
    if args.update:
        print("[import] モード: UPDATE (既存レコードも更新)")

    with open(input_path, encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError as e:
            print(f"[error] JSON パースエラー: {e}", file=sys.stderr)
            sys.exit(1)

    if not isinstance(data, list):
        print("[error] JSON の中身がリストではありません", file=sys.stderr)
        sys.exit(1)

    # キャプチャセッション ID をファイル名から生成
    session_id: str | None = None
    stem = input_path.stem
    m = re.search(r"(\d{8}_\d{6})", stem)
    if m:
        session_id = m.group(1)
    else:
        session_id = stem

    if is_raw_tshark(data):
        print(f"[import] tshark 生 JSON を検出 → 正規化中... ({len(data)} フレーム)")
        print(f"[import] セッション ID: {session_id}")

        records: list[dict] = []
        parse_skipped = 0
        for frame in data:
            rec = parse_frame(frame, session_id=session_id)
            if rec:
                records.append(rec)
            else:
                parse_skipped += 1

        print(f"[import] 正規化: {len(records)} 件 ({parse_skipped} 件スキップ)")

        # ── Post-processing ────────────────────────────────────────────────
        print("[import] Post-processing: relativeTime / flowId を計算中...")
        assign_relative_time(records)
        assign_flow_ids(records, session_id)

        # 統計表示
        proto_dist: dict[str, int] = {}
        flow_count = len({r.get("flowId") for r in records if r.get("flowId")})
        quic_count = sum(1 for r in records if r.get("isQuicCandidate"))
        syn_count  = sum(1 for r in records if r.get("tcpSyn"))
        for r in records:
            p = r["protocol"]
            proto_dist[p] = proto_dist.get(p, 0) + 1
        top = sorted(proto_dist.items(), key=lambda x: -x[1])[:8]
        print(f"[import] プロトコル分布: {top}")
        print(f"[import] フロー数: {flow_count} / QUIC候補: {quic_count} / TCP SYN: {syn_count}")

    else:
        records = data
        print(f"[import] 正規化済み JSON: {len(records)} 件")

    if not records:
        print("[import] 取り込み対象がありません")
        return

    inserted, updated, skipped = import_to_postgres(
        records, db_url,
        dry_run=args.dry_run,
        do_update=args.update,
    )
    print(f"[import] 完了: {inserted} 件追加, {updated} 件更新, {skipped} 件スキップ (重複)")

    if args.move and not args.dry_run and (inserted + updated) > 0:
        imported_dir = REPO_DIR / "data" / "imported"
        imported_dir.mkdir(parents=True, exist_ok=True)
        dest = imported_dir / input_path.name
        shutil.move(str(input_path), str(dest))
        print(f"[import] ファイル移動: {dest}")


if __name__ == "__main__":
    main()

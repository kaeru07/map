#!/usr/bin/env python3
"""
parse.py — tshark JSON出力を NetScope の SQLite スキーマ形式に変換する

使い方:
  python3 scripts/parse.py <input.json> [output.json]

  入力: tshark -T json で出力した生ファイル
  出力: SQLite インポート用の正規化 JSON (1行1レコード)

標準出力に書き出す場合は output.json を省略 (stdout に ndjson 形式)
"""

import json
import sys
import datetime
from typing import Any, Optional


def first(val: Any) -> Optional[str]:
    """リストならば最初の要素を返す。なければ None"""
    if isinstance(val, list):
        return val[0] if val else None
    if isinstance(val, str) and val:
        return val
    return None


DNS_TYPE_NAMES: dict = {
    "1": "A", "2": "NS", "5": "CNAME", "6": "SOA",
    "12": "PTR", "15": "MX", "16": "TXT", "28": "AAAA",
    "33": "SRV", "65": "HTTPS", "255": "ANY",
}

TLS_VERSION_NAMES: dict = {
    "768": "SSLv3", "769": "TLSv1.0", "770": "TLSv1.1",
    "771": "TLSv1.2", "772": "TLSv1.3",
}

PORT_PROTOCOL: dict = {
    21: "FTP", 22: "SSH", 25: "SMTP", 53: "DNS",
    80: "HTTP", 110: "POP3", 143: "IMAP",
    443: "HTTPS", 465: "SMTPS", 587: "SMTP",
    993: "IMAPS", 995: "POP3S", 8080: "HTTP", 8443: "HTTPS",
    51820: "WireGuard",
}


def detect_direction(src_ip: str, dst_ip: str, vpn_subnet: str = "10.") -> str:
    import os
    subnet = os.environ.get("VPN_SUBNET", vpn_subnet)
    if src_ip.startswith(subnet):
        return "outbound"
    if dst_ip.startswith(subnet):
        return "inbound"
    return "unknown"


def enhance_protocol(
    raw_proto: str, src_port: Optional[int], dst_port: Optional[int],
    tls_sni: Optional[str], dns_query: Optional[str],
    http_host: Optional[str], http_method: Optional[str],
) -> str:
    p = (raw_proto or "").strip().upper()
    KEEP = {"DNS","HTTP","HTTPS","ICMP","ARP","SSH","FTP","SMTP","QUIC",
             "NTP","MDNS","SSDP","DHCP","IGMP","ICMPV6"}
    if p in KEEP:
        return p
    if tls_sni:
        return "QUIC" if (dst_port == 443 and p in ("UDP","UNKNOWN","")) else "TLS"
    if dns_query:
        return "DNS"
    if http_host or http_method:
        return "HTTP"
    if p in ("TCP", "UDP", "UNKNOWN", ""):
        for port in (dst_port, src_port):
            if port and port in PORT_PROTOCOL:
                return "QUIC" if (port == 443 and p == "UDP") else PORT_PROTOCOL[port]
    if "QUIC" in p:
        return "QUIC"
    if p in ("TLS","SSL","TLSV1","TLSV1.0","TLSV1.1","TLSV1.2","TLSV1.3"):
        return "TLS"
    return p if p else "UNKNOWN"


def all_values(val: Any) -> list:
    if isinstance(val, list): return [v for v in val if v]
    if isinstance(val, str) and val: return [val]
    return []


def parse_frame(frame: dict) -> Optional[dict]:
    """1フレームを正規化レコードに変換"""
    layers = frame.get("_source", {}).get("layers", {})

    def g(key: str) -> Optional[str]:
        return first(layers.get(key))

    ts_raw = g("frame.time_epoch")
    if not ts_raw:
        return None
    try:
        ts = datetime.datetime.fromtimestamp(float(ts_raw), tz=datetime.timezone.utc)
        timestamp = ts.isoformat()
    except (ValueError, OSError):
        return None

    src_ip = g("ip.src") or g("ipv6.src") or ""
    dst_ip = g("ip.dst") or g("ipv6.dst") or ""
    if not src_ip or not dst_ip:
        return None

    src_port: Optional[int] = None
    dst_port: Optional[int] = None
    for proto in ("tcp", "udp"):
        sp = g(f"{proto}.srcport")
        dp = g(f"{proto}.dstport")
        if sp:
            try: src_port = int(sp)
            except ValueError: pass
        if dp:
            try: dst_port = int(dp)
            except ValueError: pass

    # ★修正: lowercase が正しいフィールド名
    raw_proto = g("_ws.col.protocol") or g("_ws.col.Protocol") or ""

    bytes_val: Optional[int] = None
    if fl := g("frame.len"):
        try: bytes_val = int(fl)
        except ValueError: pass

    dns_query   = g("dns.qry.name")
    dns_type_raw = g("dns.qry.type")
    dns_type    = DNS_TYPE_NAMES.get(dns_type_raw or "", dns_type_raw) if dns_type_raw else None
    resp_parts  = all_values(layers.get("dns.a")) + all_values(layers.get("dns.aaaa")) + all_values(layers.get("dns.cname"))
    dns_resp    = ",".join(dict.fromkeys(resp_parts)) or None

    tls_sni     = g("tls.handshake.extensions_server_name")
    tls_ver_raw = g("tls.record.version")
    tls_version = TLS_VERSION_NAMES.get(tls_ver_raw or "", None) if tls_ver_raw else None

    http_host   = g("http.host")
    http_method = g("http.request.method")
    http_path   = g("http.request.uri")
    host_name   = tls_sni or http_host or dns_query

    protocol  = enhance_protocol(raw_proto, src_port, dst_port,
                                  tls_sni, dns_query, http_host, http_method)
    direction = detect_direction(src_ip, dst_ip)

    return {
        "timestamp":  timestamp,
        "srcIp":      src_ip,
        "dstIp":      dst_ip,
        "srcPort":    src_port,
        "dstPort":    dst_port,
        "protocol":   protocol,
        "bytes":      bytes_val,
        "direction":  direction,
        "hostName":   host_name,
        "tlsSni":     tls_sni,
        "dnsQuery":   dns_query,
        "rawJson":    json.dumps(layers, ensure_ascii=False),
        "iface":      g("frame.interface_name"),
        "dnsType":    dns_type,
        "dnsResp":    dns_resp,
        "tlsVersion": tls_version,
        "httpMethod": http_method,
        "httpPath":   http_path,
    }


def main():
    if len(sys.argv) < 2:
        print(f"使い方: {sys.argv[0]} <input.json> [output.json]", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None

    with open(input_path, "r", encoding="utf-8") as f:
        try:
            frames = json.load(f)
        except json.JSONDecodeError as e:
            print(f"[error] JSON 解析エラー: {e}", file=sys.stderr)
            sys.exit(1)

    records = []
    skipped = 0
    for frame in frames:
        rec = parse_frame(frame)
        if rec:
            records.append(rec)
        else:
            skipped += 1

    print(f"[parse] {len(records)} 件変換 ({skipped} 件スキップ)", file=sys.stderr)

    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(records, f, ensure_ascii=False, indent=2)
        print(f"[parse] 出力: {output_path}", file=sys.stderr)
    else:
        # stdout に ndjson
        for rec in records:
            print(json.dumps(rec, ensure_ascii=False))


if __name__ == "__main__":
    main()

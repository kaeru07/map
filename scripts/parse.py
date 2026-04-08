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


def detect_direction(src_ip: str, dst_ip: str, vpn_subnet: str = "10.8.0.") -> str:
    """
    WireGuard の VPN サブネット (デフォルト 10.8.0.0/24) を基準に
    送信元が VPN サブネットなら outbound、それ以外は inbound と判定する。
    VPN_SUBNET 環境変数で変更可能。
    """
    import os
    subnet = os.environ.get("VPN_SUBNET", vpn_subnet)
    if src_ip.startswith(subnet):
        return "outbound"
    if dst_ip.startswith(subnet):
        return "inbound"
    return "unknown"


def parse_frame(frame: dict) -> Optional[dict]:
    """1フレームを正規化レコードに変換"""
    layers = frame.get("_source", {}).get("layers", {})

    # タイムスタンプ
    ts_raw = first(layers.get("frame.time_epoch"))
    if not ts_raw:
        return None
    try:
        ts = datetime.datetime.fromtimestamp(float(ts_raw), tz=datetime.timezone.utc)
        timestamp = ts.isoformat()
    except (ValueError, OSError):
        return None

    src_ip = first(layers.get("ip.src")) or ""
    dst_ip = first(layers.get("ip.dst")) or ""

    if not src_ip or not dst_ip:
        return None

    # ポート (TCP or UDP)
    src_port = None
    dst_port = None
    for proto in ("tcp", "udp"):
        sp = first(layers.get(f"{proto}.srcport"))
        dp = first(layers.get(f"{proto}.dstport"))
        if sp:
            try:
                src_port = int(sp)
            except ValueError:
                pass
        if dp:
            try:
                dst_port = int(dp)
            except ValueError:
                pass

    protocol = (first(layers.get("_ws.col.Protocol")) or "UNKNOWN").upper()

    bytes_val = None
    frame_len = first(layers.get("frame.len"))
    if frame_len:
        try:
            bytes_val = int(frame_len)
        except ValueError:
            pass

    # メタ情報
    dns_query = first(layers.get("dns.qry.name"))
    tls_sni = first(layers.get("tls.handshake.extensions_server_name"))
    http_host = first(layers.get("http.host"))
    host_name = tls_sni or http_host or dns_query

    direction = detect_direction(src_ip, dst_ip)

    raw_json = json.dumps(layers, ensure_ascii=False)

    return {
        "timestamp": timestamp,
        "srcIp": src_ip,
        "dstIp": dst_ip,
        "srcPort": src_port,
        "dstPort": dst_port,
        "protocol": protocol,
        "bytes": bytes_val,
        "direction": direction,
        "hostName": host_name,
        "tlsSni": tls_sni,
        "dnsQuery": dns_query,
        "rawJson": raw_json,
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

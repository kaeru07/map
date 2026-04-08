#!/usr/bin/env python3
"""
import.py — パース済み JSON を SQLite にインポートするスクリプト

使い方:
  python3 scripts/import.py <parsed.json> [--db <db_path>] [--move]

オプション:
  --db <path>   SQLite DB ファイルパス (デフォルト: web/prisma/dev.db)
  --move        取り込み後にファイルを data/imported/ へ移動
  --dry-run     実際には書き込まず件数のみ表示

例:
  python3 scripts/import.py data/raw/capture_20260408_parsed.json
  python3 scripts/import.py data/raw/capture_20260408.json --move
"""

import argparse
import json
import os
import re
import shutil
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path


# ============================================================
# パス解決
# ============================================================
SCRIPT_DIR = Path(__file__).parent
REPO_DIR = SCRIPT_DIR.parent


def resolve_db_path(db_arg: str | None) -> Path:
    """DATABASE_URL または引数から DB パスを解決する"""
    if db_arg:
        return Path(db_arg).expanduser().resolve()

    # web/.env から DATABASE_URL を読む
    env_file = REPO_DIR / "web" / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            m = re.match(r'^DATABASE_URL\s*=\s*"?([^"]+)"?', line)
            if m:
                url = m.group(1).strip()
                path_str = url.removeprefix("file:")
                if path_str.startswith("./"):
                    return (REPO_DIR / "web" / path_str[2:]).resolve()
                return Path(path_str).resolve()

    # デフォルト
    return (REPO_DIR / "web" / "prisma" / "dev.db").resolve()


# ============================================================
# tshark 生 JSON かどうかを判定して parse する
# ============================================================
def parse_frame(frame: dict) -> dict | None:
    """tshark フレーム 1件を正規化レコードに変換"""
    layers = frame.get("_source", {}).get("layers", {})

    def first(key):
        v = layers.get(key)
        if isinstance(v, list):
            return v[0] if v else None
        return v if v else None

    ts_raw = first("frame.time_epoch")
    if not ts_raw:
        return None
    try:
        ts = datetime.fromtimestamp(float(ts_raw), tz=timezone.utc)
        timestamp = ts.isoformat()
    except (ValueError, OSError):
        return None

    src_ip = first("ip.src") or first("ipv6.src") or ""
    dst_ip = first("ip.dst") or first("ipv6.dst") or ""
    if not src_ip or not dst_ip:
        return None

    src_port, dst_port = None, None
    for proto in ("tcp", "udp"):
        sp = first(f"{proto}.srcport")
        dp = first(f"{proto}.dstport")
        if sp:
            try: src_port = int(sp)
            except ValueError: pass
        if dp:
            try: dst_port = int(dp)
            except ValueError: pass

    protocol = (first("_ws.col.Protocol") or "UNKNOWN").upper()

    bytes_val = None
    if fl := first("frame.len"):
        try: bytes_val = int(fl)
        except ValueError: pass

    tls_sni  = first("tls.handshake.extensions_server_name")
    http_host = first("http.host")
    dns_query = first("dns.qry.name")
    host_name = tls_sni or http_host or dns_query

    # 方向判定 (VPN サブネット 10.x から送信 = outbound)
    vpn_subnet = os.environ.get("VPN_SUBNET", "10.")
    if src_ip.startswith(vpn_subnet):
        direction = "outbound"
    elif dst_ip.startswith(vpn_subnet):
        direction = "inbound"
    else:
        direction = "unknown"

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


def is_raw_tshark(data: list) -> bool:
    """tshark 生 JSON かどうか判定"""
    return bool(data and isinstance(data[0], dict) and "_source" in data[0])


# ============================================================
# SQLite への取り込み
# ============================================================
def import_to_sqlite(
    records: list[dict],
    db_path: Path,
    dry_run: bool = False,
) -> tuple[int, int]:
    """
    records を Packet テーブルに挿入する。
    重複チェック: (timestamp, srcIp, dstIp, srcPort, dstPort) が一致するレコードはスキップ。
    戻り値: (inserted, skipped)
    """
    if not db_path.exists():
        print(f"[error] DB ファイルが見つかりません: {db_path}", file=sys.stderr)
        print( "  npm run db:migrate を実行してください", file=sys.stderr)
        sys.exit(1)

    if dry_run:
        print(f"[dry-run] {len(records)} 件 (実際には書き込みません)")
        return 0, len(records)

    con = sqlite3.connect(str(db_path))
    cur = con.cursor()

    # テーブル確認
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='Packet'")
    if not cur.fetchone():
        print(f"[error] Packet テーブルが存在しません: {db_path}", file=sys.stderr)
        print( "  npm run db:migrate を実行してください", file=sys.stderr)
        con.close()
        sys.exit(1)

    inserted = 0
    skipped = 0

    for rec in records:
        # 重複チェック
        cur.execute(
            """
            SELECT 1 FROM Packet
            WHERE timestamp = ?
              AND srcIp = ?
              AND dstIp = ?
              AND srcPort IS ?
              AND dstPort IS ?
            LIMIT 1
            """,
            (
                rec["timestamp"],
                rec["srcIp"],
                rec["dstIp"],
                rec.get("srcPort"),
                rec.get("dstPort"),
            ),
        )
        if cur.fetchone():
            skipped += 1
            continue

        cur.execute(
            """
            INSERT INTO Packet
              (timestamp, srcIp, dstIp, srcPort, dstPort, protocol,
               bytes, direction, hostName, tlsSni, dnsQuery, rawJson, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                rec["timestamp"],
                rec["srcIp"],
                rec["dstIp"],
                rec.get("srcPort"),
                rec.get("dstPort"),
                rec["protocol"],
                rec.get("bytes"),
                rec.get("direction"),
                rec.get("hostName"),
                rec.get("tlsSni"),
                rec.get("dnsQuery"),
                rec.get("rawJson"),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        inserted += 1

    con.commit()
    con.close()
    return inserted, skipped


# ============================================================
# メイン
# ============================================================
def main():
    parser = argparse.ArgumentParser(description="NetScope JSONインポーター")
    parser.add_argument("input", help="入力 JSON ファイル (tshark 生出力 or parse済み)")
    parser.add_argument("--db", default=None, help="SQLite DB ファイルパス")
    parser.add_argument("--move", action="store_true", help="インポート後にファイルを data/imported/ へ移動")
    parser.add_argument("--dry-run", action="store_true", help="書き込まず件数のみ表示")
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    if not input_path.exists():
        print(f"[error] ファイルが見つかりません: {input_path}", file=sys.stderr)
        sys.exit(1)

    db_path = resolve_db_path(args.db)
    print(f"[import] 入力: {input_path.name}")
    print(f"[import] DB  : {db_path}")

    # JSON 読み込み
    with open(input_path, encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError as e:
            print(f"[error] JSON パースエラー: {e}", file=sys.stderr)
            sys.exit(1)

    if not isinstance(data, list):
        print("[error] JSON の中身がリストではありません", file=sys.stderr)
        sys.exit(1)

    # tshark 生 JSON なら parse
    if is_raw_tshark(data):
        print(f"[import] tshark 生 JSON を検出 → 正規化中... ({len(data)} フレーム)")
        records = []
        parse_skipped = 0
        for frame in data:
            rec = parse_frame(frame)
            if rec:
                records.append(rec)
            else:
                parse_skipped += 1
        print(f"[import] 正規化: {len(records)} 件 ({parse_skipped} 件スキップ)")
    else:
        records = data
        print(f"[import] 正規化済み JSON: {len(records)} 件")

    if not records:
        print("[import] 取り込み対象がありません")
        return

    # SQLite に取り込み
    inserted, skipped = import_to_sqlite(records, db_path, dry_run=args.dry_run)

    print(f"[import] 完了: {inserted} 件追加, {skipped} 件スキップ (重複)")

    # ファイルを移動
    if args.move and not args.dry_run and inserted > 0:
        imported_dir = REPO_DIR / "data" / "imported"
        imported_dir.mkdir(parents=True, exist_ok=True)
        dest = imported_dir / input_path.name
        shutil.move(str(input_path), str(dest))
        print(f"[import] ファイル移動: {dest}")


if __name__ == "__main__":
    main()

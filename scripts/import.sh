#!/usr/bin/env bash
# =============================================================================
# import.sh — capture.sh の出力を SQLite にインポートするラッパー
#
# 使い方:
#   ./scripts/import.sh <json_or_pcap_file> [--move] [--dry-run]
#
# オプション:
#   --move      インポート後にファイルを data/imported/ へ移動
#   --dry-run   書き込まず件数のみ確認
#
# 例:
#   ./scripts/import.sh data/raw/capture_20260408_100000.json
#   ./scripts/import.sh data/raw/capture_20260408_100000.pcap
#   ./scripts/import.sh data/raw/capture_20260408_100000.pcap --move
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ $# -lt 1 ]]; then
  echo "使い方: $0 <json_or_pcap_file> [--move] [--dry-run]"
  exit 1
fi

INPUT_FILE="$1"
shift  # 残りの引数 (--move, --dry-run) を python に渡す

# .pcap ファイルの場合は tshark で JSON に変換してからインポート
if [[ "$INPUT_FILE" == *.pcap ]]; then
  if ! command -v tshark &>/dev/null; then
    echo "[error] tshark が見つかりません。インストールしてください:" >&2
    echo "  sudo apt install -y tshark" >&2
    exit 1
  fi

  JSON_FILE="${INPUT_FILE%.pcap}.json"
  echo "[import] pcap を JSON に変換中: $(basename "$INPUT_FILE") → $(basename "$JSON_FILE")"

  tshark -r "$INPUT_FILE" \
    -T json \
    -e frame.time_epoch \
    -e frame.interface_name \
    -e frame.len \
    -e ip.src \
    -e ip.dst \
    -e ip.proto \
    -e ip.ttl \
    -e ip.len \
    -e ipv6.src \
    -e ipv6.dst \
    -e tcp.srcport \
    -e tcp.dstport \
    -e tcp.flags \
    -e tcp.flags.syn \
    -e tcp.flags.fin \
    -e tcp.flags.reset \
    -e tcp.flags.push \
    -e tcp.flags.ack \
    -e tcp.seq \
    -e tcp.stream \
    -e udp.srcport \
    -e udp.dstport \
    -e udp.length \
    -e udp.stream \
    -e "_ws.col.protocol" \
    -e dns.qry.name \
    -e dns.qry.type \
    -e dns.a \
    -e dns.aaaa \
    -e dns.cname \
    -e "tls.handshake.extensions_server_name" \
    -e tls.record.version \
    -e tls.handshake.ciphersuite \
    -e tls.handshake.type \
    -e tls.handshake.session_id \
    -e quic.connection_id \
    -e quic.version \
    -e http.host \
    -e http.request.method \
    -e http.request.uri \
    -e http.response.code \
    -e http.content_length \
    -e http.content_type \
    2>/dev/null > "$JSON_FILE"

  if [[ ! -s "$JSON_FILE" ]]; then
    echo "[error] tshark による変換結果が空です" >&2
    rm -f "$JSON_FILE"
    exit 1
  fi

  echo "[import] 変換完了: $(basename "$JSON_FILE")"
  INPUT_FILE="$JSON_FILE"
fi

python3 "$SCRIPT_DIR/import.py" "$INPUT_FILE" "$@"

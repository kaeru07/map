#!/usr/bin/env bash
# =============================================================================
# capture.sh — VPS側 tshark キャプチャスクリプト
#
# 使い方:
#   sudo ./scripts/capture.sh [インターフェース名] [出力ディレクトリ]
#
# 例:
#   sudo ./scripts/capture.sh wg0 /var/lib/netscope/raw
#   sudo ./scripts/capture.sh any /tmp/netscope-raw
# =============================================================================

set -euo pipefail

IFACE="${1:-wg0}"
OUT_DIR="${2:-/var/lib/netscope/raw}"
DURATION="${CAPTURE_DURATION:-300}"   # 秒 (デフォルト5分)

# 出力ディレクトリ作成
mkdir -p "$OUT_DIR"

# 出力ファイル名 (タイムスタンプ付き)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUT_FILE="$OUT_DIR/capture_${TIMESTAMP}.json"

echo "[capture] インターフェース: $IFACE"
echo "[capture] 出力: $OUT_FILE"
echo "[capture] キャプチャ時間: ${DURATION}秒"
echo "[capture] Ctrl+C で停止"

# tshark が存在するか確認
if ! command -v tshark &>/dev/null; then
  echo "[error] tshark が見つかりません。インストールしてください:"
  echo "  sudo apt install tshark"
  exit 1
fi

# -----------------------------------------------------------------------------
# tshark で通信メタ情報を JSON 形式でキャプチャ
# 取得フィールド:
#   frame.time_epoch   — UNIXタイムスタンプ
#   ip.src / ip.dst    — 送受信 IP
#   tcp.srcport / tcp.dstport
#   udp.srcport / udp.dstport
#   _ws.col.Protocol   — プロトコル名
#   frame.len          — フレームサイズ (bytes)
#   dns.qry.name       — DNS クエリ名
#   tls.handshake.extensions_server_name — TLS SNI
#   http.host          — HTTP Host ヘッダ
# -----------------------------------------------------------------------------

tshark \
  -i "$IFACE" \
  -a duration:"$DURATION" \
  -T json \
  -e frame.time_epoch \
  -e ip.src \
  -e ip.dst \
  -e tcp.srcport \
  -e tcp.dstport \
  -e udp.srcport \
  -e udp.dstport \
  -e _ws.col.Protocol \
  -e frame.len \
  -e dns.qry.name \
  -e tls.handshake.extensions_server_name \
  -e http.host \
  -e http.request.method \
  -e http.request.uri \
  2>/dev/null \
  > "$OUT_FILE"

echo "[capture] 完了: $OUT_FILE"
echo "[capture] 次のステップ: ./scripts/import.sh $OUT_FILE"

#!/usr/bin/env bash
# =============================================================================
# capture.sh — VPS 側パケットキャプチャスクリプト
#
# 使い方:
#   sudo ./scripts/capture.sh [OPTIONS]
#
# オプション:
#   -i <iface>    キャプチャ対象インターフェース (デフォルト: wg0)
#   -t <secs>     キャプチャ時間 [秒] (デフォルト: 300)
#   -o <dir>      出力ディレクトリ (デフォルト: ./data/raw)
#   -n            件数制限 (パケット数。-t と排他。tshark のみ)
#   --tcpdump     tshark ではなく tcpdump を強制使用
#
# 環境変数 (オプション):
#   CAPTURE_IFACE    インターフェース名
#   CAPTURE_DURATION キャプチャ秒数
#   CAPTURE_OUT_DIR  出力ディレクトリ
#
# 出力:
#   data/raw/capture_YYYYMMDD_HHMMSS.json  (tshark)
#   data/raw/capture_YYYYMMDD_HHMMSS.pcap  (tcpdump)
#
# 例:
#   sudo ./scripts/capture.sh -i wg0 -t 60
#   sudo ./scripts/capture.sh -i any -t 300 -o /tmp/netscope-raw
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ============================================================
# デフォルト値
# ============================================================
IFACE="${CAPTURE_IFACE:-wg0}"
DURATION="${CAPTURE_DURATION:-300}"
OUT_DIR="${CAPTURE_OUT_DIR:-$REPO_DIR/data/raw}"
FORCE_TCPDUMP=0
MAX_PACKETS=""

# ============================================================
# 引数パース
# ============================================================
while [[ $# -gt 0 ]]; do
  case "$1" in
    -i) IFACE="$2"; shift 2 ;;
    -t) DURATION="$2"; shift 2 ;;
    -o) OUT_DIR="$2"; shift 2 ;;
    -n) MAX_PACKETS="$2"; shift 2 ;;
    --tcpdump) FORCE_TCPDUMP=1; shift ;;
    -h|--help)
      head -30 "$0" | grep "^#" | sed 's/^# //'
      exit 0
      ;;
    *) echo "不明なオプション: $1" >&2; exit 1 ;;
  esac
done

# ============================================================
# 出力ディレクトリ作成
# ============================================================
mkdir -p "$OUT_DIR"

# ============================================================
# ツール選択
# ============================================================
USE_TSHARK=0
USE_TCPDUMP=0

if [[ $FORCE_TCPDUMP -eq 0 ]] && command -v tshark &>/dev/null; then
  USE_TSHARK=1
elif command -v tcpdump &>/dev/null; then
  USE_TCPDUMP=1
else
  echo "[error] tshark も tcpdump も見つかりません" >&2
  echo "  sudo apt install tshark" >&2
  exit 1
fi

# ============================================================
# キャプチャ実行
# ============================================================
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "[capture] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[capture] インターフェース : $IFACE"
echo "[capture] キャプチャ時間   : ${DURATION}秒"
echo "[capture] 出力ディレクトリ : $OUT_DIR"
echo "[capture] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ----------------------------------------------------------
# tshark モード
# ----------------------------------------------------------
if [[ $USE_TSHARK -eq 1 ]]; then
  OUT_FILE="$OUT_DIR/capture_${TIMESTAMP}.json"
  echo "[capture] ツール: tshark → $OUT_FILE"
  echo "[capture] Ctrl+C で停止"
  echo ""

  # tshark オプション組み立て
  TSHARK_ARGS=(
    -i "$IFACE"
    -T json
    # 基本フレーム情報
    -e frame.time_epoch
    -e frame.interface_name
    -e frame.len
    # IP (IPv4 / IPv6)
    -e ip.src
    -e ip.dst
    -e ip.proto
    -e ip.ttl
    -e ip.len
    -e ipv6.src
    -e ipv6.dst
    # ポート (TCP / UDP)
    -e tcp.srcport
    -e tcp.dstport
    -e udp.srcport
    -e udp.dstport
    # プロトコル列 (lowercase が正しい)
    -e "_ws.col.protocol"
    # DNS 拡張
    -e dns.qry.name
    -e dns.qry.type
    -e dns.a
    -e dns.aaaa
    -e dns.cname
    # ── TCP 詳細 (v4拡張) ──────────────────────────────────────
    -e tcp.flags           # フラグ全体 (hex)
    -e tcp.flags.syn       # SYN ビット (0/1)
    -e tcp.flags.fin       # FIN ビット (0/1)
    -e tcp.flags.reset     # RST ビット (0/1)
    -e tcp.flags.push      # PSH ビット (0/1)
    -e tcp.flags.ack       # ACK ビット (0/1)
    -e tcp.seq             # シーケンス番号 (フロー確認用)
    -e tcp.stream          # ストリーム ID (tshark が自動付与)
    # ── UDP 詳細 ────────────────────────────────────────────────
    -e udp.length
    -e udp.stream          # UDPストリーム ID
    # ── IP 詳細 ─────────────────────────────────────────────────
    # (ip.proto / ip.ttl / ip.len は上の IP セクションに移動済み)
    # ── TLS / QUIC (v4拡張) ─────────────────────────────────────
    -e "tls.handshake.extensions_server_name"
    -e tls.record.version
    -e tls.handshake.ciphersuite
    -e tls.handshake.type
    -e tls.handshake.session_id   # TLS セッション ID
    # QUIC (tshark 3.6+ で取得可能、未対応バージョンでは無視される)
    -e quic.connection_id
    -e quic.version
    # HTTP
    -e http.host
    -e http.request.method
    -e http.request.uri
    -e http.response.code
    -e http.content_length
    -e http.content_type
  )

  if [[ -n "$MAX_PACKETS" ]]; then
    TSHARK_ARGS+=(-c "$MAX_PACKETS")
  else
    TSHARK_ARGS+=(-a duration:"$DURATION")
  fi

  tshark "${TSHARK_ARGS[@]}" 2>/dev/null > "$OUT_FILE" || true

  # 出力確認
  if [[ -s "$OUT_FILE" ]]; then
    COUNT=$(python3 -c "import json; d=json.load(open('$OUT_FILE')); print(len(d))" 2>/dev/null || echo "?")
    SIZE=$(du -sh "$OUT_FILE" | cut -f1)
    echo ""
    echo "[capture] 完了: $COUNT フレーム ($SIZE)"
    echo "[capture] 出力: $OUT_FILE"
    echo ""
    echo "[capture] 次のステップ:"
    echo "  ./scripts/import.sh $OUT_FILE"
  else
    echo "[capture] 警告: 出力ファイルが空です"
    echo "  - インターフェース名が正しいか確認: ip link show"
    echo "  - sudo または wireshark グループが必要"
    rm -f "$OUT_FILE"
    exit 1
  fi

# ----------------------------------------------------------
# tcpdump モード (フォールバック)
# ----------------------------------------------------------
elif [[ $USE_TCPDUMP -eq 1 ]]; then
  OUT_FILE="$OUT_DIR/capture_${TIMESTAMP}.pcap"
  echo "[capture] ツール: tcpdump (tshark なし) → $OUT_FILE"
  echo "[capture] Ctrl+C で停止"
  echo ""

  tcpdump \
    -i "$IFACE" \
    -w "$OUT_FILE" \
    -G "$DURATION" \
    -W 1 \
    2>/dev/null || true

  if [[ -s "$OUT_FILE" ]]; then
    SIZE=$(du -sh "$OUT_FILE" | cut -f1)
    echo ""
    echo "[capture] 完了 ($SIZE)"
    echo "[capture] 出力: $OUT_FILE"
    echo ""
    echo "[capture] .pcap から JSON に変換するには tshark をインストールして:"
    echo "  tshark -r $OUT_FILE -T json > ${OUT_FILE%.pcap}.json"
    echo "  ./scripts/import.sh ${OUT_FILE%.pcap}.json"
  else
    echo "[capture] 警告: 出力ファイルが空です"
    rm -f "$OUT_FILE"
    exit 1
  fi
fi

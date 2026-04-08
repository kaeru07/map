#!/usr/bin/env bash
# =============================================================================
# import.sh — capture.sh の出力を SQLite にインポートするラッパー
#
# 使い方:
#   ./scripts/import.sh <json_file> [--move] [--dry-run]
#
# オプション:
#   --move      インポート後にファイルを data/imported/ へ移動
#   --dry-run   書き込まず件数のみ確認
#
# 例:
#   ./scripts/import.sh data/raw/capture_20260408_100000.json
#   ./scripts/import.sh data/raw/capture_20260408_100000.json --move
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ $# -lt 1 ]]; then
  echo "使い方: $0 <json_file> [--move] [--dry-run]"
  exit 1
fi

python3 "$SCRIPT_DIR/import.py" "$@"

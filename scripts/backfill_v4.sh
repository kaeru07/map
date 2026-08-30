#!/usr/bin/env bash
# =============================================================================
# backfill_v4.sh — data/raw/*.json を --update で再インポートして v4 フィールドを埋める
#
# 使い方:
#   ./scripts/backfill_v4.sh [data/raw/]
#
# オプション:
#   引数に JSON ディレクトリを指定（デフォルト: data/raw/）
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="${1:-data/raw}"

if [[ ! -d "$DATA_DIR" ]]; then
  echo "[error] ディレクトリが見つかりません: $DATA_DIR" >&2
  exit 1
fi

shopt -s nullglob
files=("$DATA_DIR"/*.json)

if [[ ${#files[@]} -eq 0 ]]; then
  echo "[backfill] JSON ファイルが見つかりません: $DATA_DIR"
  exit 0
fi

echo "[backfill] ${#files[@]} 件の JSON を --update モードで再インポートします..."
echo ""

total_added=0
total_updated=0
total_skipped=0

for f in "${files[@]}"; do
  echo "=== $(basename "$f") ==="
  result=$(python3 "$SCRIPT_DIR/import.py" "$f" --update 2>&1)
  echo "$result" | grep -E "フロー数|完了"

  added=$(echo "$result"   | grep -oP '\d+(?= 件追加)'   | head -1 || echo 0)
  updated=$(echo "$result" | grep -oP '\d+(?= 件更新)'   | head -1 || echo 0)
  skipped=$(echo "$result" | grep -oP '\d+(?= 件スキップ)' | head -1 || echo 0)
  total_added=$((total_added + added))
  total_updated=$((total_updated + updated))
  total_skipped=$((total_skipped + skipped))
  echo ""
done

echo "=== 合計 ==="
echo "  追加: ${total_added} 件 / 更新: ${total_updated} 件 / スキップ: ${total_skipped} 件"

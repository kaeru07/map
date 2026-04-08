#!/usr/bin/env bash
# =============================================================================
# dev-reset.sh — 開発用 DB リセット & サンプルデータ再投入
#
# 使い方:
#   bash scripts/dev-reset.sh
#   bash scripts/dev-reset.sh --no-seed  # シードなし
# =============================================================================

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WEB_DIR="$REPO_DIR/web"

NO_SEED=0
for arg in "$@"; do
  [[ "$arg" == "--no-seed" ]] && NO_SEED=1
done

echo "[dev-reset] 開発 DB をリセットします..."

cd "$WEB_DIR"

# .env 読み込み
if [[ -f .env ]]; then
  set -a; source .env; set +a
fi

# DB ファイルのパスを解決
DB_URL="${DATABASE_URL:-file:./prisma/dev.db}"
DB_PATH="${DB_URL#file:}"
if [[ "$DB_PATH" == ./* ]]; then
  DB_PATH="$WEB_DIR/${DB_PATH#./}"
fi

if [[ -f "$DB_PATH" ]]; then
  echo "[dev-reset] DB 削除: $DB_PATH"
  rm -f "$DB_PATH"
fi

echo "[dev-reset] マイグレーション実行..."
npm run db:migrate 2>&1 | grep -E "✔|✓|Error|error" || true

if [[ $NO_SEED -eq 0 ]]; then
  echo "[dev-reset] サンプルデータを投入..."
  npm run db:seed
fi

echo "[dev-reset] 完了"
if command -v sqlite3 &>/dev/null && [[ -f "$DB_PATH" ]]; then
  COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Packet;" 2>/dev/null || echo "?")
  echo "[dev-reset] DB: $COUNT 件"
fi

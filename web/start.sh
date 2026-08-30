#!/bin/bash
# NetScope 起動スクリプト
# PM2 経由で起動しても .env.local / .env を確実に読み込む

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# .env.local を優先してロード（存在すれば）
if [ -f "$SCRIPT_DIR/.env.local" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$SCRIPT_DIR/.env.local"
  set +a
fi

# .env をフォールバックでロード（まだ未設定の変数のみ）
if [ -f "$SCRIPT_DIR/.env" ]; then
  while IFS='=' read -r key value; do
    # コメント・空行をスキップ
    [[ "$key" =~ ^[[:space:]]*# ]] && continue
    [[ -z "$key" ]] && continue
    # すでに空でない値が設定されていたらスキップ
    if [ -z "${!key}" ]; then
      export "$key=$value"
    fi
  done < "$SCRIPT_DIR/.env"
fi

echo "[NetScope/start] DIRECT_URL=${DIRECT_URL:+✓ set}${DIRECT_URL:-✗ missing}"
echo "[NetScope/start] DATABASE_URL=${DATABASE_URL:+✓ set}${DATABASE_URL:-✗ missing}"

exec npm start

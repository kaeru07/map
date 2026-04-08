#!/usr/bin/env bash
# =============================================================================
# run-local.sh — ローカル開発・VPS での Web アプリ起動スクリプト
#
# 使い方:
#   ./scripts/run-local.sh          # 開発サーバー起動 (ホットリロード)
#   ./scripts/run-local.sh prod     # プロダクションビルド + 起動
#   ./scripts/run-local.sh seed     # サンプルデータをシードして開発起動
# =============================================================================

set -euo pipefail

MODE="${1:-dev}"
WEB_DIR="$(dirname "$0")/../web"

cd "$WEB_DIR"

case "$MODE" in
  dev)
    echo "[run] 開発サーバー起動 (http://localhost:3000)"
    npm run dev
    ;;
  prod)
    echo "[run] プロダクションビルド中..."
    npm run build
    echo "[run] プロダクションサーバー起動 (http://localhost:3000)"
    npm run start
    ;;
  seed)
    echo "[run] サンプルデータをシード中..."
    npm run db:seed
    echo "[run] 開発サーバー起動 (http://localhost:3000)"
    npm run dev
    ;;
  *)
    echo "使い方: $0 [dev|prod|seed]"
    exit 1
    ;;
esac

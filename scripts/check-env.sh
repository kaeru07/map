#!/usr/bin/env bash
# =============================================================================
# check-env.sh — 実行環境の確認スクリプト
#
# 使い方:
#   bash scripts/check-env.sh
# =============================================================================

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WEB_DIR="$REPO_DIR/web"

ok()   { echo -e "  \033[1;32m✓\033[0m  $*"; }
fail() { echo -e "  \033[1;31m✗\033[0m  $*"; FAILED=1; }
warn() { echo -e "  \033[1;33m△\033[0m  $*"; }
info() { echo -e "  \033[1;34m→\033[0m  $*"; }

FAILED=0

echo ""
echo "  NetScope 環境チェック"
echo "  ─────────────────────────────────────"
echo ""
echo "  [ツール]"

# Node.js
if command -v node &>/dev/null; then
  VER=$(node --version)
  MAJOR=$(echo "$VER" | sed 's/v//' | cut -d. -f1)
  if [[ "$MAJOR" -ge 20 ]]; then
    ok "Node.js $VER"
  else
    warn "Node.js $VER (v20 以上を推奨)"
  fi
else
  fail "Node.js が見つかりません"
fi

# npm
if command -v npm &>/dev/null; then
  ok "npm $(npm --version)"
else
  fail "npm が見つかりません"
fi

# Python3
if command -v python3 &>/dev/null; then
  ok "Python $(python3 --version 2>&1 | awk '{print $2}')"
else
  fail "python3 が見つかりません"
fi

# tshark
if command -v tshark &>/dev/null; then
  ok "tshark $(tshark --version 2>&1 | head -1 | awk '{print $2, $3}')"
  # 権限チェック
  if groups | grep -q wireshark; then
    ok "wireshark グループ: あり"
  else
    warn "wireshark グループ未参加 → sudo が必要 (sudo usermod -aG wireshark \$USER)"
  fi
else
  warn "tshark が見つかりません → tcpdump フォールバックを使用"
fi

# tcpdump
if command -v tcpdump &>/dev/null; then
  ok "tcpdump $(tcpdump --version 2>&1 | head -1 | awk '{print $2, $3}')"
else
  warn "tcpdump も見つかりません"
fi

# sqlite3
if command -v sqlite3 &>/dev/null; then
  ok "sqlite3 $(sqlite3 --version 2>&1 | awk '{print $1}')"
else
  warn "sqlite3 コマンドが見つかりません (apt install sqlite3)"
fi

# jq
if command -v jq &>/dev/null; then
  ok "jq $(jq --version)"
else
  warn "jq が見つかりません (apt install jq)"
fi

echo ""
echo "  [ファイル]"

# .env
if [[ -f "$WEB_DIR/.env" ]]; then
  ok ".env ファイルあり"
  # DATABASE_URL チェック
  DB_URL=$(grep "^DATABASE_URL=" "$WEB_DIR/.env" | cut -d= -f2- | tr -d '"')
  if [[ -n "$DB_URL" ]]; then
    ok "DATABASE_URL = $DB_URL"
    # ファイルパス抽出
    DB_PATH="${DB_URL#file:}"
    # 相対パスを絶対パスに変換
    if [[ "$DB_PATH" == ./* ]]; then
      DB_PATH="$WEB_DIR/${DB_PATH#./}"
    fi
    if [[ -f "$DB_PATH" ]]; then
      DB_SIZE=$(du -sh "$DB_PATH" 2>/dev/null | cut -f1)
      ok "DB ファイルあり: $DB_PATH ($DB_SIZE)"
    else
      warn "DB ファイルなし: $DB_PATH (npm run db:migrate で作成)"
    fi
  else
    fail "DATABASE_URL が設定されていません"
  fi
else
  fail ".env が見つかりません (cp web/.env.example web/.env)"
fi

# node_modules
if [[ -d "$WEB_DIR/node_modules" ]]; then
  ok "node_modules インストール済み"
else
  fail "node_modules がありません (cd web && npm install)"
fi

# Prisma クライアント生成済みか
if [[ -f "$WEB_DIR/app/generated/prisma/client.ts" ]]; then
  ok "Prisma クライアント生成済み"
else
  fail "Prisma クライアント未生成 (cd web && npx prisma generate)"
fi

echo ""
echo "  [DB テーブル]"

# DB テーブル確認
if command -v sqlite3 &>/dev/null && [[ -n "${DB_PATH:-}" ]] && [[ -f "$DB_PATH" ]]; then
  TABLES=$(sqlite3 "$DB_PATH" ".tables" 2>/dev/null)
  if echo "$TABLES" | grep -q "Packet"; then
    COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Packet;" 2>/dev/null || echo "?")
    ok "Packet テーブルあり ($COUNT 件)"
  else
    warn "Packet テーブルなし (npm run db:migrate で作成)"
  fi
fi

echo ""
echo "  [ネットワーク]"

# WireGuard インターフェース確認
if ip link show wg0 &>/dev/null 2>&1; then
  WG_STATE=$(ip link show wg0 | grep -o "state [A-Z]*" | awk '{print $2}')
  if [[ "$WG_STATE" == "UP" ]]; then
    ok "wg0 UP"
  else
    warn "wg0 DOWN (sudo wg-quick up wg0)"
  fi
elif command -v wg &>/dev/null; then
  warn "wg0 インターフェースなし (sudo wg-quick up wg0)"
else
  warn "WireGuard 未インストール"
fi

# キャプチャ可能なインターフェース一覧
echo ""
info "利用可能なインターフェース:"
ip -o link show | awk -F': ' '{print "       ", $2}' | grep -v "lo"

echo ""
echo "  ─────────────────────────────────────"

if [[ $FAILED -eq 0 ]]; then
  echo -e "  \033[1;32m✓ 環境チェック OK\033[0m"
else
  echo -e "  \033[1;31m✗ 問題があります。上記を確認してください。\033[0m"
fi
echo ""

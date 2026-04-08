#!/usr/bin/env bash
# =============================================================================
# setup-vps.sh — ConoHa VPS 初回セットアップスクリプト
#
# 使い方:
#   sudo bash scripts/setup-vps.sh
#
# 実行内容:
#   - 必要パッケージのインストール
#   - ディレクトリ作成
#   - 実行権限の付与
#   - wireshark グループへのユーザー追加
# =============================================================================

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WEB_DIR="$REPO_DIR/web"

# ============================================================
# ユーティリティ
# ============================================================
info()  { echo -e "\033[1;34m[setup]\033[0m $*"; }
ok()    { echo -e "\033[1;32m[ ok  ]\033[0m $*"; }
warn()  { echo -e "\033[1;33m[warn ]\033[0m $*"; }
error() { echo -e "\033[1;31m[error]\033[0m $*" >&2; }

# root チェック
if [[ $EUID -ne 0 ]]; then
  error "このスクリプトは sudo で実行してください"
  error "  sudo bash $0"
  exit 1
fi

# 実行ユーザーを記録 (sudo の場合は SUDO_USER)
REAL_USER="${SUDO_USER:-$USER}"

echo ""
echo "  ╔══════════════════════════════════╗"
echo "  ║   NetScope VPS セットアップ      ║"
echo "  ╚══════════════════════════════════╝"
echo ""

# ============================================================
# 1. パッケージ更新
# ============================================================
info "apt update..."
apt-get update -qq

# ============================================================
# 2. 必要パッケージのインストール
# ============================================================
PACKAGES=(
  "tshark"        # パケットキャプチャ (Wireshark CLI)
  "tcpdump"       # tshark が使えない場合のフォールバック
  "sqlite3"       # DB 直接操作
  "jq"            # JSON 処理
  "curl"          # HTTP テスト
  "python3"       # parse.py 実行
  "python3-pip"   # (将来用)
)

info "パッケージをインストール中..."
for pkg in "${PACKAGES[@]}"; do
  if dpkg -l "$pkg" &>/dev/null; then
    ok "$pkg (既インストール)"
  else
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$pkg"
    ok "$pkg インストール完了"
  fi
done

# ============================================================
# 3. tshark 権限設定
# ============================================================
info "tshark の権限設定..."

# tshark インストール時の interactive プロンプトを非対話で設定
echo "wireshark-common wireshark-common/install-setuid boolean true" | debconf-set-selections
dpkg-reconfigure -f noninteractive wireshark-common 2>/dev/null || true

# 実行ユーザーを wireshark グループに追加
if id "$REAL_USER" &>/dev/null; then
  usermod -aG wireshark "$REAL_USER"
  ok "$REAL_USER を wireshark グループに追加 (再ログイン後に有効)"
fi

# ============================================================
# 4. Node.js 確認
# ============================================================
info "Node.js 確認..."
if command -v node &>/dev/null; then
  NODE_VER=$(node --version)
  ok "Node.js $NODE_VER"
  MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
  if [[ "$MAJOR" -lt 20 ]]; then
    warn "Node.js v20 以上を推奨します (現在: $NODE_VER)"
    warn "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -"
    warn "  sudo apt-get install -y nodejs"
  fi
else
  warn "Node.js が見つかりません"
  warn "インストール例:"
  warn "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -"
  warn "  sudo apt-get install -y nodejs"
fi

# ============================================================
# 5. ディレクトリ作成
# ============================================================
info "ディレクトリを作成中..."
DIRS=(
  "$REPO_DIR/data"
  "$REPO_DIR/data/raw"
  "$REPO_DIR/data/imported"
  "$REPO_DIR/logs"
)

for d in "${DIRS[@]}"; do
  mkdir -p "$d"
  if [[ -n "$REAL_USER" ]]; then
    chown "$REAL_USER:$REAL_USER" "$d" 2>/dev/null || true
  fi
  ok "$d"
done

# ============================================================
# 6. スクリプトに実行権限を付与
# ============================================================
info "スクリプトに実行権限を付与..."
chmod +x "$REPO_DIR/scripts/"*.sh "$REPO_DIR/scripts/"*.py 2>/dev/null || true
ok "scripts/ 以下のファイルに +x"

# ============================================================
# 7. .env の初期化
# ============================================================
if [[ ! -f "$WEB_DIR/.env" ]]; then
  info ".env を作成..."
  cp "$WEB_DIR/.env.example" "$WEB_DIR/.env"
  # DB パスを絶対パスに書き換え
  DB_ABS_PATH="$WEB_DIR/prisma/dev.db"
  sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"file:$DB_ABS_PATH\"|" "$WEB_DIR/.env"
  ok ".env 作成 (DATABASE_URL=$DB_ABS_PATH)"
else
  ok ".env は既に存在します"
fi

# ============================================================
# 8. 完了メッセージ
# ============================================================
echo ""
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║   セットアップ完了                               ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo ""
echo "  次のステップ:"
echo ""
echo "  1. ログアウト→再ログイン (wireshark グループ反映)"
echo ""
echo "  2. Web アプリの初期化:"
echo "     cd $WEB_DIR"
echo "     npm install"
echo "     npm run db:migrate"
echo ""
echo "  3. 環境チェック:"
echo "     bash $REPO_DIR/scripts/check-env.sh"
echo ""
echo "  4. サンプルデータで UI 確認:"
echo "     cd $WEB_DIR && npm run db:seed && npm run dev"
echo ""

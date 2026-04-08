# NetScope — 通信可視化ツール

iPhone → WireGuard VPN → ConoHa VPS → インターネット の構成で、
VPS 側でキャプチャした通信メタ情報を Web ブラウザで可視化するツールです。

---

## 全体構成

```
iPhone
  │
  │  WireGuard VPN (UDP)
  ▼
ConoHa VPS (wg0 インターフェース)
  │
  ├─ scripts/capture.sh   … tshark で wg0 の通信をキャプチャ
  ├─ scripts/parse.py     … JSON 正規化
  ├─ scripts/import.sh    … SQLite に取り込み
  │
  └─ web/                 … Next.js Web アプリ
        ├─ prisma/dev.db  … SQLite データベース
        └─ http://vps:3000 または Vercel
```

---

## セットアップ

### 前提条件

| 環境 | 必要なもの |
|------|-----------|
| VPS | Ubuntu 22.04+, Node.js 20+, tshark, Python 3.10+ |
| iPhone | WireGuard アプリ |
| 開発マシン | Node.js 20+ |

---

### 1. リポジトリのクローン

```bash
git clone https://github.com/kaeru07/map.git netscope
cd netscope
```

### 2. Web アプリのセットアップ

```bash
cd web
cp .env.example .env
npm install
npm run db:migrate   # SQLite DB + テーブル作成
npm run db:seed      # サンプルデータ投入 (任意)
```

### 3. 開発サーバー起動

```bash
npm run dev
# → http://localhost:3000 で確認
```

---

## VPS セットアップ

### tshark インストール

```bash
sudo apt update
sudo apt install -y tshark
# インストール時に "非スーパーユーザーに許可" → Yes を選択
sudo usermod -aG wireshark $USER
# 再ログイン後に有効
```

### WireGuard セットアップ (概要)

```bash
sudo apt install -y wireguard
# wg0.conf を設定
# iPhone 側の公開鍵をサーバーに登録
sudo systemctl enable --now wg-quick@wg0
```

### Web アプリを VPS で起動

```bash
cd web
cp .env.example .env
# DATABASE_URL を絶対パスに変更 (例: file:/home/user/netscope/web/prisma/dev.db)
vim .env
npm install
npm run db:migrate
npm run build
npm run start
# → http://VPS_IP:3000 でアクセス
```

ファイアウォールで 3000 番ポートを開放:

```bash
sudo ufw allow 3000/tcp
```

---

## 通信キャプチャの流れ

### 手動キャプチャ (デフォルト5分間)

```bash
# VPS 上で実行 (要 sudo または wireshark グループ)
sudo ./scripts/capture.sh wg0 /tmp/netscope-raw
```

### インポート

```bash
# tshark 生出力 → 自動変換して SQLite に取り込み
./scripts/import.sh /tmp/netscope-raw/capture_20260408_100000.json
```

### ブラウザで確認

`http://VPS_IP:3000/packets` を開き、データが表示されることを確認。

---

## 定期キャプチャ (将来の常駐化)

現時点は手動起動前提ですが、将来的に systemd サービスにすることを想定した構成にしています。

```bash
# crontab に追加する例 (30分ごとにキャプチャ + インポート)
*/30 * * * * /path/to/netscope/scripts/capture.sh wg0 /var/lib/netscope/raw && \
             /path/to/netscope/scripts/import.sh $(ls -t /var/lib/netscope/raw/*.json | head -1)
```

---

## Vercel デプロイ

> **注意**: Vercel はサーバーレス環境のため、SQLite ファイルを直接使うことはできません。

### Option A: VPS 単独運用 (推奨・追加コストなし)

VPS 上で Next.js を動かし続け、Vercel には載せない。最もシンプルな構成。

### Option B: Turso (分散 SQLite) に移行して Vercel にデプロイ

```bash
# Turso CLI インストール
curl -sSfL https://get.tur.so/install.sh | bash

# DB を Turso に作成
turso db create netscope

# .env の DATABASE_URL を Turso URL に変更
DATABASE_URL="libsql://netscope-<user>.turso.io"
```

Vercel の Environment Variables に設定後、`vercel deploy`。

### Vercel プロジェクト設定

| 設定 | 値 |
|------|-----|
| Framework Preset | Next.js |
| Root Directory | `web` |
| Build Command | `npm run build` |
| Output Directory | `.next` |

---

## ディレクトリ構成

```
netscope/
├── web/                        # Next.js Web アプリ
│   ├── app/
│   │   ├── api/
│   │   │   ├── packets/        # GET /api/packets (一覧・フィルタ)
│   │   │   │   └── [id]/       # GET /api/packets/:id
│   │   │   └── stats/          # GET /api/stats
│   │   ├── packets/
│   │   │   ├── page.tsx        # 通信一覧ページ
│   │   │   └── [id]/page.tsx   # 通信詳細ページ
│   │   ├── layout.tsx
│   │   └── page.tsx            # / → /packets にリダイレクト
│   ├── components/
│   │   ├── StatsCards.tsx      # 上部統計カード
│   │   ├── FilterBar.tsx       # フィルタバー
│   │   ├── PacketTable.tsx     # 通信一覧テーブル
│   │   ├── PacketDetail.tsx    # 詳細パネル
│   │   └── ProtocolBadge.tsx   # プロトコルバッジ
│   ├── lib/
│   │   ├── db.ts               # Prisma クライアント初期化
│   │   └── types.ts            # 型定義
│   ├── prisma/
│   │   ├── schema.prisma       # DB スキーマ
│   │   ├── seed.ts             # サンプルデータ
│   │   └── dev.db              # SQLite DB (gitignore)
│   └── .env.example
├── scripts/
│   ├── capture.sh              # tshark キャプチャ (VPS で実行)
│   ├── parse.py                # JSON 正規化
│   ├── import.sh               # SQLite インポート
│   └── run-local.sh            # 起動ヘルパー
├── sample-data/
│   └── sample_packets.json     # インポート形式サンプル
└── README.md
```

---

## 注意事項

- **法的事項**: 自分の端末・自分の VPS での通信監視専用です。他者の通信のキャプチャは不正アクセス禁止法に違反する可能性があります。
- **HTTPS 復号**: TLS の平文復号は対象外。SNI・ホスト名・DNS クエリなどのメタ情報のみ取得します。
- **Claude Code との共存**: Claude Code 使用中はキャプチャを停止してください (`Ctrl+C`)。
- **パフォーマンス**: 高トラフィック環境での常時監視は推奨しません。必要時のみ起動する設計です。

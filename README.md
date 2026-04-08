# NetScope — 通信可視化ツール

iPhone → WireGuard VPN → ConoHa VPS の経路で流れる通信のメタ情報を、
Web ブラウザ上で Wireshark 風に可視化するツールです。

---

## 全体構成

```
iPhone (WireGuard クライアント)
  │
  │  WireGuard VPN トンネル
  ▼
ConoHa VPS  ── wg0 インターフェース
  │
  ├─ scripts/capture.sh    ← tshark で wg0 をキャプチャ
  ├─ scripts/import.sh     ← 生 JSON を SQLite に取り込み
  │                            (重複チェック付き)
  ├─ data/raw/             ← キャプチャ生ファイル置き場
  ├─ data/imported/        ← 取り込み済みファイル置き場
  │
  └─ web/                  ← Next.js Web アプリ
       ├─ prisma/dev.db    ← SQLite データベース
       └─ :3000            ← Web UI
```

**VPS 側に置くもの**: Web アプリ、DB、キャプチャスクリプト全て

**Vercel に置くもの**: 将来的に Turso 等に移行した場合の Web アプリのみ。
MVP 段階では VPS 単独で完結させる。

---

## 初回セットアップ (VPS)

### 1. パッケージ・権限の自動セットアップ

```bash
git clone https://github.com/kaeru07/map.git netscope
cd netscope
sudo bash scripts/setup-vps.sh
```

実行内容:
- `tshark` `tcpdump` `sqlite3` `jq` `python3` をインストール
- wireshark グループにユーザーを追加
- `data/raw/` `data/imported/` `logs/` を作成
- `web/.env` を自動生成 (DATABASE_URL は絶対パスで設定)

**その後、再ログインして wireshark グループを反映させること**

### 2. Web アプリの初期化

```bash
cd netscope/web
npm install
npm run db:migrate
```

### 3. 環境チェック

```bash
bash ../scripts/check-env.sh
```

全項目 `✓` になれば準備完了。

### 4. サンプルデータで UI 確認

```bash
npm run db:seed
npm run start
# → http://VPS_IP:3000 でアクセス
```

---

## 通信キャプチャの手順

### iPhone を WireGuard で接続

1. VPS に WireGuard をセットアップ (`wg0` インターフェース)
2. iPhone に WireGuard アプリをインストールし、設定をインポート
3. iPhone から VPN 接続 → VPS の `wg0` に通信が流れる

接続確認:
```bash
sudo wg show
# iPhone のピアが "latest handshake" を持っていれば OK
```

### キャプチャ実行

```bash
# デフォルト (wg0 を 5分間)
sudo ./scripts/capture.sh

# オプション指定
sudo ./scripts/capture.sh -i wg0 -t 60         # 60秒
sudo ./scripts/capture.sh -i wg0 -t 300 -o /tmp  # 出力先変更
```

### SQLite に取り込み

```bash
# 直接取り込み (tshark 生 JSON → 自動変換)
./scripts/import.sh data/raw/capture_YYYYMMDD_HHMMSS.json

# 取り込み後にファイルを data/imported/ へ移動
./scripts/import.sh data/raw/capture_YYYYMMDD_HHMMSS.json --move

# 件数確認だけ
./scripts/import.sh data/raw/capture_YYYYMMDD_HHMMSS.json --dry-run
```

### サンプルデータで動作確認 (キャプチャなしで UI 確認)

```bash
# sample-data/ のサンプルを直接インポート
python3 scripts/import.py sample-data/sample_packets.json
```

---

## Web アプリの起動

### VPS で起動 (本番)

```bash
cd web
npm run build
npm start
```

ファイアウォール開放:
```bash
sudo ufw allow 3000/tcp
```

### 開発サーバー

```bash
cd web
npm run dev  # ホットリロード付き
```

---

## 開発用コマンド

```bash
# DB リセット + サンプルデータ再投入
bash scripts/dev-reset.sh

# シードなしでリセット
bash scripts/dev-reset.sh --no-seed

# Prisma Studio (GUI でデータ確認)
cd web && npm run db:studio
```

---

## VPS 側で必要なパッケージ

| パッケージ | 用途 |
|-----------|------|
| `tshark` | パケットキャプチャ (主力) |
| `tcpdump` | tshark が使えない場合のフォールバック |
| `sqlite3` | DB 直接操作・確認 |
| `jq` | JSON 整形 |
| `python3` | import.py, parse.py の実行 |
| `nodejs` v20+ | Next.js Web アプリ |

インストール:
```bash
sudo apt update
sudo apt install -y tshark tcpdump sqlite3 jq python3

# Node.js v22 (推奨)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs
```

tshark の権限設定:
```bash
sudo usermod -aG wireshark $USER
# 再ログイン後に有効
# 確認: groups | grep wireshark
```

---

## トラブルシューティング

### tshark が空のファイルを出力する

```bash
# インターフェース名を確認
ip link show
# wg0 が UP かどうか確認
ip link show wg0

# sudo で試す (wireshark グループが効いていない場合)
sudo tshark -i wg0 -a duration:5 -T json

# iPhone が実際に VPN 経由で通信しているか確認
sudo wg show
```

### import.sh でエラーが出る

```bash
# DB の存在確認
ls -la web/prisma/dev.db

# テーブルの確認
sqlite3 web/prisma/dev.db ".tables"
sqlite3 web/prisma/dev.db "SELECT COUNT(*) FROM Packet;"

# マイグレーションが未実行の場合
cd web && npm run db:migrate
```

### Web アプリがデータを表示しない

```bash
# DB に直接クエリ
sqlite3 web/prisma/dev.db "SELECT * FROM Packet LIMIT 5;"

# API レスポンス確認
curl http://localhost:3000/api/stats
curl "http://localhost:3000/api/packets?page=1&pageSize=10"
```

### DATABASE_URL のパス問題

```bash
# .env の確認
cat web/.env

# 絶対パスを使うことを推奨 (VPS では特に)
# DATABASE_URL="file:/home/user/netscope/web/prisma/dev.db"
```

---

## ディレクトリ構成

```
netscope/
├── web/                         # Next.js Web アプリ
│   ├── app/
│   │   ├── api/packets/         # GET /api/packets
│   │   │        /[id]/          # GET /api/packets/:id
│   │   │   /stats/              # GET /api/stats
│   │   ├── packets/page.tsx     # 通信一覧 (フィルタ・詳細パネル)
│   │   └── packets/[id]/page.tsx  # 通信詳細 (SSR)
│   ├── components/
│   │   ├── StatsCards.tsx       # 統計カード (件数・プロトコル・直近)
│   │   ├── FilterBar.tsx        # フィルタバー
│   │   ├── PacketTable.tsx      # 通信一覧テーブル
│   │   ├── PacketDetail.tsx     # 詳細パネル (JSON タブ付き)
│   │   └── ProtocolBadge.tsx    # プロトコルバッジ
│   ├── lib/
│   │   ├── db.ts                # Prisma + libsql adapter
│   │   └── types.ts             # 型定義・プロトコル色定義
│   ├── prisma/
│   │   ├── schema.prisma        # Packet テーブル定義 + インデックス
│   │   ├── seed.ts              # サンプルデータ
│   │   └── dev.db               # SQLite DB (gitignore)
│   └── .env.example
├── scripts/
│   ├── setup-vps.sh             # VPS 初回セットアップ
│   ├── check-env.sh             # 環境チェック
│   ├── capture.sh               # tshark/tcpdump キャプチャ
│   ├── import.sh                # import.py のラッパー
│   ├── import.py                # JSON → SQLite 取り込み (重複チェック付き)
│   ├── parse.py                 # tshark JSON 正規化
│   ├── dev-reset.sh             # 開発用 DB リセット
│   └── run-local.sh             # 起動ヘルパー
├── sample-data/
│   └── sample_packets.json      # インポート形式サンプル
└── README.md
```

---

## iPhone 通信確認前チェックリスト

- [ ] VPS で WireGuard が起動している (`sudo wg show`)
- [ ] iPhone で WireGuard アプリが VPN 接続中
- [ ] `ip link show wg0` で wg0 が UP
- [ ] wireshark グループに参加している (`groups | grep wireshark`)
- [ ] `bash scripts/check-env.sh` が全項目 ✓
- [ ] Web アプリが起動している (`http://VPS_IP:3000`)

---

## 注意事項

- **法的事項**: 自分の端末・自分の VPS のみを対象にしてください
- **Claude Code との共存**: Claude Code 使用中はキャプチャを停止してください
- **HTTPS 復号対象外**: SNI・ホスト名・DNS クエリなどのメタ情報のみ取得
- **高負荷に注意**: 長時間の全通信キャプチャは VPS の負荷になります

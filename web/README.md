# NetScope — 通信可視化ダッシュボード

WireGuard VPN 経由の通信メタ情報を可視化する Next.js アプリです。  
iPhone を ConoHa VPN 経由でインターネット接続させ、その通信をキャプチャ・分析できます。

---

## VPN 構成概要

```
iPhone
  │  WireGuard (全通信をトンネル)
  │  AllowedIPs = 0.0.0.0/0
  ▼
ConoHa VPS  ─── wg0 (10.0.0.1/24) ← NetScope がここをキャプチャ
  │  IP Forwarding + NAT (MASQUERADE)
  ▼
Internet
```

| 役割 | 値 |
|---|---|
| サーバー公開 IP | `160.251.143.146` |
| WireGuard ポート | UDP 51820 |
| サーバー VPN IP | `10.0.0.1` |
| iPhone VPN IP | `10.0.0.2` |
| キャプチャ対象インターフェース | `wg0` |
| 方向判定 | `10.x.x.x` 始まり = outbound (VPN発) |

---

## iPhone を VPN に接続する手順

### ステップ 1: WireGuard アプリをインストール

App Store で **「WireGuard」** (公式) を検索してインストール。

### ステップ 2: 設定をインポート (QR コードが最も簡単)

**方法A — QR コードを読む (推奨)**

サーバーで以下を実行してターミナルに QR コードを表示:

```bash
qrencode -t ansiutf8 < /etc/wireguard/iphone_client.conf
```

iPhone の WireGuard アプリ → 右上「+」→「QR コードをスキャン」でカメラを向ける。

**方法B — 手動入力**

WireGuard アプリ → 「+」→「一から作成」で以下を入力:

```ini
[Interface]
PrivateKey = MPrQWiV0iQP3QqJldnRoSp7JQ8XfKw/rOkmnBcwRC3w=
Address = 10.0.0.2/32
DNS = 1.1.1.1, 8.8.8.8

[Peer]
PublicKey = Sq49ydMPI25fbk5/gLlzWp/KY2xHFnhhN/aDTOPNdUc=
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = 160.251.143.146:51820
PersistentKeepalive = 25
```

### ステップ 3: VPN を有効化

WireGuard アプリでトンネルをオンにする → iOS が VPN 接続を許可するか確認が出るので許可。

### ステップ 4: 接続確認

```bash
# サーバー側でハンドシェイクを確認
wg show wg0
# → "latest handshake: X seconds ago" が表示されれば接続成功

# iPhone から ping テスト (iPhone のターミナルアプリ or サーバー側から)
ping 10.0.0.2
```

ブラウザで [https://ifconfig.me](https://ifconfig.me) にアクセスして `160.251.143.146` が表示されれば全通信がVPN経由になっています。

---

## NetScope で iPhone 通信をキャプチャする手順

### ステップ 1: iPhone を VPN に接続した状態でキャプチャ開始

**UI から操作する場合:**

1. `/packets` ページ上部の「キャプチャ管理」→「**開始**」ボタン
2. iPhone で通常通りブラウジング / アプリ操作
3. 「**停止**」→「**インポート**」の順に押す
4. 一覧に iPhone の通信が表示される

**手動で実行する場合:**

```bash
# wg0 インターフェースをキャプチャ (デフォルト設定そのままで OK)
sudo /root/map/scripts/capture.sh

# キャプチャ完了後にインポート
/root/map/scripts/import.sh data/raw/capture_YYYYMMDD_HHMMSS.json
```

### ステップ 2: 通信を確認

- `srcIp = 10.0.0.2` → iPhone からの通信 (outbound)
- `dstIp = 10.0.0.2` → iPhone 宛ての通信 (inbound)
- `direction = outbound` → iPhone が外部に接続した通信
- プロトコルフィルタで DNS/TLS/HTTPS などを絞り込む

---

## サーバー側の設定 (現在の状態・変更不要)

| 項目 | 状態 |
|---|---|
| WireGuard インストール | ✅ 済み |
| `/etc/wireguard/wg0.conf` | ✅ 設定済み |
| wg0 インターフェース起動 | ✅ 稼働中 (10.0.0.1/24) |
| IP Forwarding | ✅ 有効 |
| NAT (MASQUERADE via eth0) | ✅ 設定済み |
| UFW ポート 51820/UDP | ✅ 開放済み |
| systemd 自動起動 | ✅ enabled (`wg-quick@wg0`) |
| iPhone ピア登録 | ✅ 登録済み |

### wg0.conf の内容

```ini
[Interface]
Address = 10.0.0.1/24
ListenPort = 51820
PrivateKey = (サーバー秘密鍵)

PostUp = sysctl -w net.ipv4.ip_forward=1
PostUp = iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

# iPhone (10.0.0.2)
[Peer]
PublicKey = 5rE6ykH+tsBW5cqu+xWTLwZFGON7u+wSZvz41+JRGT8=
AllowedIPs = 10.0.0.2/32
```

### 鍵ファイルの場所

| ファイル | 内容 | 権限 |
|---|---|---|
| `/etc/wireguard/privatekey` | サーバー秘密鍵 | 600 |
| `/etc/wireguard/publickey` | サーバー公開鍵 | 644 |
| `/etc/wireguard/iphone_private.key` | iPhone 秘密鍵 | 600 |
| `/etc/wireguard/iphone_public.key` | iPhone 公開鍵 | 600 |
| `/etc/wireguard/iphone_client.conf` | iPhone クライアント設定 | 600 |

> ⚠️ `/etc/wireguard/iphone_client.conf` は iPhone の秘密鍵を含みます。  
> Web の public/ には置かず、サーバー上の root のみがアクセスできる場所に保管しています。

---

## VPN の停止・再起動

```bash
# 停止
wg-quick down wg0

# 起動
wg-quick up wg0

# 再起動
systemctl restart wg-quick@wg0

# 状態確認
wg show wg0
systemctl status wg-quick@wg0
```

---

## VPN トラブルシューティング

**iPhone が接続できない**
```bash
# ポートが開いているか確認
ss -ulnp | grep 51820

# UFW で 51820 が許可されているか
ufw status | grep 51820

# wg0 が起動しているか
ip link show wg0
wg show wg0
```

**ハンドシェイクが確立しない**
```bash
# サーバー公開鍵を確認 (iPhone 設定の PublicKey と一致するか)
cat /etc/wireguard/publickey
# → Sq49ydMPI25fbk5/gLlzWp/KY2xHFnhhN/aDTOPNdUc= であること

# ピアの公開鍵を確認
wg show wg0 peers
# → 5rE6ykH+tsBW5cqu+xWTLwZFGON7u+wSZvz41+JRGT8= であること
```

**VPN は繋がるが通信がインターネットに出ない**
```bash
# IP Forwarding が有効か
cat /proc/sys/net/ipv4/ip_forward   # 1 であること

# NAT ルールがあるか
iptables -t nat -L POSTROUTING -n
# → MASQUERADE ルールがあること
```

**iPhone の通信が NetScope に表示されない**
```bash
# wg0 でトラフィックが流れているか確認
tcpdump -i wg0 -c 20 2>/dev/null

# キャプチャファイルが生成されているか
ls -lh /root/map/data/raw/

# import.py の方向判定が機能するか確認
# srcIp が 10.0.0.2 (10. 始まり) → direction = outbound と判定される
```

**再起動後に wg0 が上がらない**
```bash
# enabled になっているか確認
systemctl is-enabled wg-quick@wg0   # → enabled

# 手動で起動
wg-quick up wg0
```

---

## セキュリティ注意事項 (VPN 関連)

- iPhone の秘密鍵 (`iphone_private.key`) はサーバー上の `/etc/wireguard/` のみに保管
- `iphone_client.conf` は Web の public/ には絶対に置かない
- `AllowedIPs = 10.0.0.2/32` により、このピアからは 10.0.0.2 の IP しか受け付けない
- iPhone 側の `AllowedIPs = 0.0.0.0/0` により、全通信がVPN経由になる (スプリットトンネルなし)
- 別の端末を追加する場合は、別の鍵ペアを作成し別の IP (10.0.0.3 など) を割り当てる

---

## iPhone を追加・鍵を再生成する場合

```bash
cd /etc/wireguard
umask 077

# 新しい鍵ペアを生成
wg genkey | tee iphone_private.key | wg pubkey > iphone_public.key

# wg0.conf の Peer PublicKey を新しいものに更新
# (iphone_public.key の内容に置き換える)
nano /etc/wireguard/wg0.conf

# 実行中の wg0 に反映 (再起動なし)
wg syncconf wg0 <(wg-quick strip wg0)

# iPhone 用クライアント設定を再生成
SERVER_PUBKEY=$(cat publickey)
IPHONE_PRIVKEY=$(cat iphone_private.key)
cat > iphone_client.conf << EOF
[Interface]
PrivateKey = ${IPHONE_PRIVKEY}
Address = 10.0.0.2/32
DNS = 1.1.1.1, 8.8.8.8

[Peer]
PublicKey = ${SERVER_PUBKEY}
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = 160.251.143.146:51820
PersistentKeepalive = 25
EOF
chmod 600 iphone_client.conf

# QR コードを表示して iPhone でスキャン
qrencode -t ansiutf8 < iphone_client.conf
```

---

## 技術スタック

| 項目 | 内容 |
|---|---|
| フレームワーク | Next.js 16 (App Router) |
| DB | Supabase (PostgreSQL) |
| ORM | Prisma 7 (`@prisma/adapter-pg`) |
| ホスティング | Vercel (Root Directory: `web`) |
| スタイル | Tailwind CSS v4 |

---

## 動作モード

| モード | 条件 | 動作 |
|---|---|---|
| **デモモード** | `DATABASE_URL` 未設定 | サンプルデータ15件を表示。黄色バナーが出る。 |
| **本番モード** | `DATABASE_URL` 設定済み・DB接続成功 | Supabase の実データを表示。 |
| **フォールバック** | DB接続失敗（タイムアウト等） | サンプルデータを表示。クラッシュしない。 |

---

## DB 設計

### テーブル: `packets`

| カラム | PostgreSQL 型 | Nullable | デフォルト | 説明 |
|---|---|---|---|---|
| `id` | `TEXT` | NO | `cuid()` | 主キー。cuid による文字列 ID |
| `timestamp` | `TIMESTAMP(3)` | NO | — | 通信発生時刻 |
| `srcIp` | `TEXT` | NO | — | 送信元 IP |
| `dstIp` | `TEXT` | NO | — | 宛先 IP |
| `srcPort` | `INTEGER` | YES | NULL | 送信元ポート |
| `dstPort` | `INTEGER` | YES | NULL | 宛先ポート |
| `protocol` | `TEXT` | NO | — | プロトコル (TLS/DNS/HTTP 等) |
| `bytes` | `INTEGER` | YES | NULL | パケットサイズ (bytes) |
| `direction` | `TEXT` | YES | NULL | `outbound` / `inbound` |
| `hostName` | `TEXT` | YES | NULL | ホスト名 |
| `tlsSni` | `TEXT` | YES | NULL | TLS SNI |
| `dnsQuery` | `TEXT` | YES | NULL | DNS クエリ名 |
| `rawJson` | `JSONB` | YES | NULL | キャプチャの生データ (JSON) |
| `createdAt` | `TIMESTAMP(3)` | NO | `now()` | レコード作成時刻 |
| `updatedAt` | `TIMESTAMP(3)` | NO | 自動更新 | レコード更新時刻 |

### インデックス

| インデックス | 対象カラム | 用途 |
|---|---|---|
| `packets_timestamp_idx` | `timestamp` | 一覧の降順取得（最重要） |
| `packets_protocol_idx` | `protocol` | プロトコルフィルタ |
| `packets_dstIp_timestamp_idx` | `(dstIp, timestamp)` | 特定宛先の時系列クエリ |
| `packets_dstPort_idx` | `dstPort` | ポートフィルタ（443, 53 等） |

---

## Supabase セットアップ

### ステップ 1: Supabase プロジェクトを作成する

1. [https://supabase.com](https://supabase.com) でアカウント作成・ログイン
2. 左上の **「New project」** をクリック
3. 以下を設定:

   | 項目 | 設定例 |
   |---|---|
   | **Organization** | 自分のアカウント or 組織 |
   | **Project name** | `netscope` |
   | **Database password** | 強いパスワードを設定（必ずメモする） |
   | **Region** | `Northeast Asia (Tokyo)` — 日本に近いほど遅延が少ない |

4. **「Create new project」** をクリック
5. プロビジョニングに **約 1〜2 分** かかります。完了を待ちます。

### ステップ 2: 接続文字列を取得する

プロジェクト作成後、左サイドバーの **「Connect」** をクリックします。

> または: **Project Settings → Database → Connection string**

接続文字列は **2種類** 必要です:

#### `DATABASE_URL` — Transaction Mode (ポート 6543)

Vercel のサーバーレス関数や通常クエリに使います。  
「Connect」画面 → **「App Framework」タブ** → 「Connection string」のフォームから:

```
postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

> `[project-ref]` はプロジェクト固有の文字列（例: `abcdefghijklmn`）  
> `[YOUR-PASSWORD]` はステップ 1 で設定したパスワード

#### `DIRECT_URL` — Direct Connection (ポート 5432)

`prisma migrate` / `prisma db push` の実行時に使います（Vercel では不要）。  
「Connect」画面 → **「Database」タブ** → 「URI」から:

```
postgresql://postgres:[YOUR-PASSWORD]@db.[project-ref].supabase.co:5432/postgres
```

---

## Vercel の設定

### ステップ 3: Vercel にデプロイする

1. [https://vercel.com](https://vercel.com) で GitHub リポジトリをインポート
2. **Framework Preset**: Next.js
3. **Root Directory**: `web` に変更（重要）
4. **「Environment Variables」** に以下を追加:

   | Name | Value | 環境 |
   |---|---|---|
   | `DATABASE_URL` | Transaction Mode の接続文字列 (6543) | Production / Preview |
   | `DIRECT_URL` | Direct の接続文字列 (5432) | Production / Preview (任意) |

   > `DATABASE_URL` だけ設定すれば動きます。  
   > `DIRECT_URL` は Vercel では使いません（ローカルの migrate 実行時のみ必要）。

5. **「Deploy」** をクリック

---

## ローカル開発手順

### ステップ 4: ローカルの環境変数を設定する

```bash
cd web
cp .env.example .env
```

`.env` を開いて以下を記入:

```env
# Transaction Mode (6543) — Vercel / ローカルの通常クエリ
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# Direct Connection (5432) — prisma migrate / db push に必要
DIRECT_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"
```

> `.env` に `DATABASE_URL` を書かなければデモモードで起動します。

### ステップ 5: 依存関係インストール

```bash
npm install
# → prisma generate が自動実行されます (postinstall)
```

### ステップ 6: Supabase にテーブルを作成する (初回のみ)

```bash
# Migration を適用（DIRECT_URL を使って直接接続）
npm run db:migrate:deploy
```

> `DIRECT_URL` が未設定の場合は代わりに以下も可:
> ```bash
> npm run db:push
> ```

### ステップ 7: サンプルデータを投入する (任意)

```bash
npm run db:seed
```

投入後に以下で確認できます:

| URL | 見えるもの |
|---|---|
| `/packets` | 15件のパケット一覧（DNS, TLS, HTTP, HTTPS, ICMP, UDP） |
| `/packets?protocol=DNS` | DNS クエリ4件 |
| `/packets?protocol=TLS` | TLS パケット8件 |
| Stats カード | total=15, 各プロトコル |
| `/packets/[id]` | 詳細ページ（rawJson の内容も表示） |

### ステップ 8: 開発サーバーを起動する

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開くと `/packets` にリダイレクトされます。

---

## Migration コマンド一覧

| コマンド | 内容 | いつ使うか |
|---|---|---|
| `npm run db:push` | スキーマを DB に直接反映（履歴なし） | 試作・初回の簡易確認 |
| `npm run db:migrate:dev` | 開発用マイグレーションファイルを生成・適用 | スキーマ変更時（ローカル） |
| `npm run db:migrate:deploy` | 既存の migration を本番 DB に適用 | Supabase への初回・追加適用 |
| `npm run db:seed` | サンプルデータを投入 | 開発・動作確認時 |
| `npm run db:studio` | Prisma Studio でデータを GUI 確認 | デバッグ時 |

### 環境別の推奨フロー

```
【Supabase への初回テーブル作成】
  ローカルで: npm run db:migrate:deploy   ← DIRECT_URL 必須

【スキーマを変更したとき】
  ローカルで: npm run db:migrate:dev      ← migration ファイルを生成
  Supabase へ反映: npm run db:migrate:deploy

【Vercel ビルド時】
  自動で prisma generate のみ実行（postinstall）
  → migrate は実行しない（Vercel から直接 migrate しない）

【手軽に試したいとき（履歴不要）】
  npm run db:push   ← migration ファイルを作らずに反映
```

> **注意**: Vercel のビルドプロセスでは `prisma migrate` を実行しないこと。  
> マイグレーションは必ずローカルから `DIRECT_URL` 経由で実行してください。

---

## ユーザーが実際にやる作業まとめ

### Supabase で最初にやること

1. [supabase.com](https://supabase.com) でプロジェクト作成
2. 「Connect」画面から `DATABASE_URL`（6543）と `DIRECT_URL`（5432）をコピー
3. パスワードを `[YOUR-PASSWORD]` の部分に置き換える

### ローカルで最初にやること

```bash
cd web
npm install
cp .env.example .env
# .env に DATABASE_URL と DIRECT_URL を記入
npm run db:migrate:deploy   # テーブル作成
npm run db:seed             # サンプルデータ投入
npm run dev
```

### Vercel で設定すること

- **Root Directory**: `web`
- **Environment Variables**:
  - `DATABASE_URL` = Transaction Mode 接続文字列 (6543)
  - `DIRECT_URL` = Direct 接続文字列 (5432)（任意）

### デプロイ後の確認方法

1. Vercel のデプロイ URL を開く → `/packets` にリダイレクト
2. Stats カードに `total: N` が表示されれば DB 接続成功
3. 黄色のデモバナーが出ている場合は `DATABASE_URL` が未設定

---

## ディレクトリ構成 (web/)

```
web/
├── app/
│   ├── api/
│   │   ├── packets/route.ts        # GET /api/packets (フィルタ・ページネーション付き)
│   │   ├── packets/[id]/route.ts   # GET /api/packets/:id
│   │   └── stats/route.ts          # GET /api/stats
│   ├── packets/
│   │   ├── page.tsx                # 通信一覧 (client component)
│   │   └── [id]/page.tsx           # 通信詳細 (server component)
│   ├── page.tsx                    # / → /packets リダイレクト
│   └── layout.tsx
├── components/
│   ├── StatsCards.tsx
│   ├── FilterBar.tsx
│   ├── PacketTable.tsx
│   ├── PacketDetail.tsx
│   └── ProtocolBadge.tsx
├── lib/
│   ├── db.ts                       # Prisma singleton + isDemoMode()
│   ├── sample-data.ts              # デモ用サンプルデータ (15件)
│   └── types.ts                    # TypeScript 型定義
└── prisma/
    ├── schema.prisma               # PostgreSQL スキーマ (packets テーブル)
    ├── seed.ts                     # サンプルデータ投入スクリプト (15件)
    └── migrations/
        └── 20260409000000_init_postgresql/migration.sql
```

---

## 404 / 接続エラーの対策

- API routes はすべて `isDemoMode()` チェック + `try/catch` で保護
- `DATABASE_URL` 未設定 → デモモード（黄色バナー表示）
- DB 接続失敗 → サンプルデータにフォールバック（クラッシュしない）
- 詳細ページ (`/packets/[id]`) もデモモード対応済み

---

## 管理UI — キャプチャ操作

### 概要

通信一覧ページ (`/packets`) の上部に **キャプチャ管理パネル** が表示されます。
ブラウザから以下の操作が可能です。

| 操作 | ボタン | 内部処理 |
|---|---|---|
| キャプチャ開始 | 開始 | `bash /root/map/scripts/capture.sh` をバックグラウンド起動 |
| キャプチャ停止 | 停止 | PID にシグナルを送り、プロセスグループを終了 |
| DBへのインポート | インポート | `data/raw/` 内の最新 `capture_*.json` に対して `bash /root/map/scripts/import.sh <file>` を実行 |
| 状態・一覧更新 | 状態更新 | ステータス取得 + パケット一覧 + stats を再取得 |

---

### 仕組み

```
[ブラウザ]
  ↓ POST /api/capture/start
[Next.js API route]
  ↓ spawn("bash", ["/root/map/scripts/capture.sh"], { detached: true })
[capture.sh]
  → tshark (or tcpdump) でパケットキャプチャ
  → data/raw/capture_YYYYMMDD_HHMMSS.json を出力
  → 指定秒数後に自動終了

[ブラウザ]
  ↓ POST /api/capture/import
[Next.js API route]
  ↓ execFile("bash", ["/root/map/scripts/import.sh", <最新ファイル>])
[import.sh → import.py]
  → JSON を解析して Supabase (PostgreSQL) に INSERT
```

**状態管理ファイル**: `/root/map/data/capture-state.json`

```json
{
  "running": true,
  "pid": 12345,
  "lastStartedAt": "2026-04-09T10:00:00.000Z",
  "lastImportedAt": "2026-04-09T10:06:00.000Z",
  "lastMessage": "キャプチャを開始しました"
}
```

---

### 追加された API

| エンドポイント | メソッド | 内容 |
|---|---|---|
| `/api/capture/status` | GET | 現在の実行状態を JSON で返す |
| `/api/capture/start` | POST | キャプチャを開始 (二重起動防止あり) |
| `/api/capture/stop` | POST | キャプチャを停止 (停止中でも安全) |
| `/api/capture/import` | POST | 最新の JSON ファイルをインポート |

---

### 必要な権限

| 操作 | 必要な権限 |
|---|---|
| キャプチャ開始 | `tshark` / `tcpdump` の実行権限 |
| キャプチャ停止 | プロセスの所有者権限 (kill) |
| インポート | `data/raw/` の読み取り権限、DB への書き込み権限 |

---

### sudo が必要な場合の注意

`tshark` や `tcpdump` はネットワークインターフェースへのアクセスにルート権限が必要な場合があります。

**方法 1: root ユーザーで実行 (推奨・デフォルト)**

`/root/` で動かしている場合、この問題は発生しません。

**方法 2: 一般ユーザーで tshark を使う**

```bash
# wireshark グループに追加 (Debian/Ubuntu)
sudo usermod -aG wireshark $USER
sudo dpkg-reconfigure wireshark-common  # "Yes" を選択
# 再ログインして反映
```

**方法 3: sudoers で特定コマンドのみ許可**

```bash
# /etc/sudoers.d/netscope
www-data ALL=(root) NOPASSWD: /root/map/scripts/capture.sh
```

> capture.sh を直接 sudo 実行する場合は start/route.ts の `spawn` コマンドを  
> `spawn("sudo", ["/root/map/scripts/capture.sh"], ...)` に変更してください。

---

### root 以外で動かす場合の考慮点

1. `capture.sh` が `tshark`/`tcpdump` を呼べるか確認 (`wireshark` グループ or sudo)
2. `data/raw/` への書き込み権限が必要
3. `data/capture-state.json` (状態ファイル) への読み書き権限が必要
4. Next.js の実行ユーザーが `kill` を送れる必要がある (通常 capture.sh と同じユーザーならOK)

---

### セキュリティ上の注意

- **任意コマンド実行は不可**: UIからコマンドや引数を入力するUIは存在しない
- **実行コマンドはソースコードに固定**: `spawn("bash", ["/root/map/scripts/capture.sh"])` のみ
- **引数注入防止**: `execFile` / `spawn` に配列で渡しているため、shell 展開が発生しない
- **インポート対象ファイルはシステムが選択**: `data/raw/` 配下の最新ファイルを自動選択、ユーザー入力は使わない
- **認証なし**: このUIはローカル・自分専用の運用を前提にしています。外部公開する場合は認証を別途追加してください

---

### 管理UIの使い方

1. ブラウザで `/packets` を開く
2. 画面上部の **キャプチャ管理** パネルを確認する
3. 状態バッジで「停止中」/「キャプチャ中」を確認
4. **開始** ボタンを押してキャプチャを開始
   - `capture.sh` がバックグラウンドで起動する (デフォルト 300 秒)
   - バッジが「キャプチャ中」に変わる
5. キャプチャが完了 (or **停止** ボタンで中断) したら **インポート** を押す
   - `data/raw/` 内の最新 `capture_*.json` を自動検出してインポート
   - 成功すると一覧・stats が自動更新される
6. **状態更新** ボタンで手動でステータス・一覧・stats を再取得できる

---

### 手動運用との違い

| 操作 | 手動 | 管理UI |
|---|---|---|
| キャプチャ開始 | `sudo ./scripts/capture.sh` | ブラウザの「開始」ボタン |
| キャプチャ停止 | `Ctrl+C` or `kill <pid>` | ブラウザの「停止」ボタン |
| インポート | `./scripts/import.sh data/raw/capture_*.json` | ブラウザの「インポート」ボタン (最新ファイルを自動選択) |
| 状態確認 | `ps aux \| grep tshark` | ステータスバッジ (リアルタイム) |

---

### トラブル時の確認方法

**キャプチャが開始しない**
```bash
# tshark/tcpdump が使えるか確認
which tshark && tshark --version
which tcpdump && tcpdump --version

# 手動で起動してみる
sudo /root/map/scripts/capture.sh
```

**「インポート対象ファイルが見つかりません」が出る**
```bash
ls /root/map/data/raw/
# capture_*.json が存在しない → 先にキャプチャを実行
```

**プロセスが止まらない**
```bash
# 状態ファイルで PID を確認
cat /root/map/data/capture-state.json

# 手動でプロセスを終了
kill <pid>
# or
pkill tshark
pkill tcpdump
```

**状態がずれている (running=true だがプロセスがない)**
```bash
# 状態ファイルをリセット
echo '{"running":false,"pid":null,"lastStartedAt":null,"lastImportedAt":null,"lastMessage":null}' \
  > /root/map/data/capture-state.json
```

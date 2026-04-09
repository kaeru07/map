# NetScope — 通信可視化ダッシュボード

WireGuard VPN 経由の通信メタ情報を可視化する Next.js アプリです。  
iPhone を ConoHa VPN 経由でインターネット接続させ、その通信をキャプチャ・分析できます。

---

# NetScope とは

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

---

# 最短手順

1. iPhone で WireGuard 接続
2. `/packets` ページで「**開始**」
3. iPhone でブラウジング・アプリ操作
4. 「**停止**」→「**インポート**」
5. `/packets` で通信確認
6. 必要なら VPN 状態確認

```bash
wg show wg0
```

---

# 基本的な使い方

## ① iPhone を VPN 接続

**ステップ 1: WireGuard アプリをインストール**

App Store で **「WireGuard」** (公式) を検索してインストール。

**ステップ 2: 設定をインポート**

方法A — QR コードを読む (推奨)

サーバーで以下を実行してターミナルに QR コードを表示:

```bash
qrencode -t ansiutf8 < /etc/wireguard/iphone_client.conf
```

iPhone の WireGuard アプリ → 右上「+」→「QR コードをスキャン」でカメラを向ける。

方法B — 手動入力

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

**ステップ 3: VPN を有効化**

WireGuard アプリでトンネルをオンにする → iOS が確認を求めたら許可。

## ② 通信をキャプチャ

1. `/packets` ページ上部の「キャプチャ管理」→「**開始**」ボタン
2. iPhone で通常通りブラウジング / アプリ操作
3. 「**停止**」→「**インポート**」の順に押す

手動で実行する場合:

```bash
sudo /root/map/scripts/capture.sh
/root/map/scripts/import.sh data/raw/capture_YYYYMMDD_HHMMSS.json
```

## ③ 通信を確認

- `srcIp = 10.0.0.2` → iPhone からの通信 (outbound)
- `dstIp = 10.0.0.2` → iPhone 宛ての通信 (inbound)
- プロトコルフィルタで DNS / TLS / HTTPS などを絞り込む

---

# 接続確認コマンド

**メイン確認 — ハンドシェイクの確認 (推奨)**

```bash
wg show wg0
# → "latest handshake: X seconds ago" が表示されれば接続成功
```

**補助確認 — 疎通テスト (任意)**

```bash
ping 10.0.0.2
# ※ iPhone が ICMP に応答しない場合があるため、これだけで判断しない
```

ブラウザで [https://ifconfig.me](https://ifconfig.me) にアクセスして `160.251.143.146` が表示されれば全通信が VPN 経由になっています。

---

# トラブルシュート

### iPhone の通信が表示されない

確認項目:

- WireGuard の接続が ON になっているか
- `wg show wg0` で `latest handshake` が表示されるか
- `/packets` でキャプチャを「開始」したか
- キャプチャ後に「インポート」を押したか

### キャプチャが開始しない

```bash
which tshark && tshark --version
sudo /root/map/scripts/capture.sh
```

### 「インポート対象ファイルが見つかりません」が出る

```bash
ls /root/map/data/raw/
# capture_*.json がなければ先にキャプチャを実行
```

### プロセスが止まらない

```bash
cat /root/map/data/capture-state.json   # PID を確認
pkill tshark
pkill tcpdump
```

### 状態がずれている (running=true だがプロセスがない)

```bash
echo '{"running":false,"pid":null,"lastStartedAt":null,"lastImportedAt":null,"lastMessage":null}' \
  > /root/map/data/capture-state.json
```

### iPhone が VPN に接続できない

```bash
ss -ulnp | grep 51820       # ポートが開いているか
ufw status | grep 51820     # UFW で許可されているか
ip link show wg0            # wg0 が起動しているか
```

### ハンドシェイクが確立しない

```bash
# サーバー公開鍵を確認 (iPhone 設定の PublicKey と一致するか)
cat /etc/wireguard/publickey
# → Sq49ydMPI25fbk5/gLlzWp/KY2xHFnhhN/aDTOPNdUc= であること
```

### VPN は繋がるが通信がインターネットに出ない

```bash
cat /proc/sys/net/ipv4/ip_forward   # 1 であること
iptables -t nat -L POSTROUTING -n   # MASQUERADE ルールがあること
```

---

# サーバー側の設定 (現在の状態・変更不要)

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

## VPN の停止・再起動

```bash
wg-quick down wg0
wg-quick up wg0
systemctl restart wg-quick@wg0
wg show wg0
```

## 鍵ファイルの場所

| ファイル | 内容 | 権限 |
|---|---|---|
| `/etc/wireguard/privatekey` | サーバー秘密鍵 | 600 |
| `/etc/wireguard/publickey` | サーバー公開鍵 | 644 |
| `/etc/wireguard/iphone_private.key` | iPhone 秘密鍵 | 600 |
| `/etc/wireguard/iphone_public.key` | iPhone 公開鍵 | 600 |
| `/etc/wireguard/iphone_client.conf` | iPhone クライアント設定 | 600 |

> ⚠️ `/etc/wireguard/iphone_client.conf` は iPhone の秘密鍵を含みます。Web の public/ には置かないこと。

---

# 管理UI — キャプチャ操作

`/packets` 上部の **キャプチャ管理パネル** からブラウザで操作できます。

| 操作 | ボタン | 内部処理 |
|---|---|---|
| キャプチャ開始 | 開始 | `capture.sh` をバックグラウンド起動 |
| キャプチャ停止 | 停止 | PID にシグナルを送りプロセス終了 |
| DBへのインポート | インポート | `data/raw/` 内の最新 JSON を自動選択してインポート |
| 状態更新 | 状態更新 | ステータス・一覧・stats を再取得 |

## API エンドポイント

| エンドポイント | メソッド | 内容 |
|---|---|---|
| `/api/capture/status` | GET | 実行状態を JSON で返す |
| `/api/capture/start` | POST | キャプチャ開始 (二重起動防止あり) |
| `/api/capture/stop` | POST | キャプチャ停止 |
| `/api/capture/import` | POST | 最新 JSON をインポート |

---

# 技術スタック

| 項目 | 内容 |
|---|---|
| フレームワーク | Next.js (App Router) |
| DB | Supabase (PostgreSQL) |
| ORM | Prisma (`@prisma/adapter-pg`) |
| ホスティング | Vercel (Root Directory: `web`) |
| スタイル | Tailwind CSS v4 |

## 動作モード

| モード | 条件 | 動作 |
|---|---|---|
| **デモモード** | `DATABASE_URL` 未設定 | サンプルデータ15件を表示。黄色バナーが出る。 |
| **本番モード** | `DATABASE_URL` 設定済み・DB接続成功 | Supabase の実データを表示。 |
| **フォールバック** | DB接続失敗（タイムアウト等） | サンプルデータを表示。クラッシュしない。 |

---

# セットアップ (初回のみ)

## Supabase

1. [supabase.com](https://supabase.com) でプロジェクト作成
2. 「Connect」画面から `DATABASE_URL`（ポート 6543）と `DIRECT_URL`（ポート 5432）をコピー
3. パスワードを `[YOUR-PASSWORD]` の部分に置き換える

## ローカル開発

```bash
cd web
npm install
cp .env.example .env
# .env に DATABASE_URL と DIRECT_URL を記入
npm run db:migrate:deploy   # テーブル作成
npm run db:seed             # サンプルデータ投入
npm run dev
```

## Vercel

- **Root Directory**: `web`
- **Environment Variables**:
  - `DATABASE_URL` = Transaction Mode 接続文字列 (6543)
  - `DIRECT_URL` = Direct 接続文字列 (5432)（任意）

## Migration コマンド

| コマンド | 内容 | いつ使うか |
|---|---|---|
| `npm run db:push` | スキーマを DB に直接反映 | 試作・初回の簡易確認 |
| `npm run db:migrate:dev` | 開発用 migration ファイルを生成・適用 | スキーマ変更時（ローカル） |
| `npm run db:migrate:deploy` | 既存 migration を本番 DB に適用 | Supabase への初回・追加適用 |
| `npm run db:seed` | サンプルデータを投入 | 開発・動作確認時 |
| `npm run db:studio` | Prisma Studio で GUI 確認 | デバッグ時 |

> **注意**: Vercel ビルドでは `prisma migrate` を実行しないこと。マイグレーションは必ずローカルから `DIRECT_URL` 経由で実行。

---

# ディレクトリ構成 (web/)

```
web/
├── app/
│   ├── api/
│   │   ├── packets/route.ts        # GET /api/packets
│   │   ├── packets/[id]/route.ts   # GET /api/packets/:id
│   │   ├── capture/                # キャプチャ管理 API
│   │   └── vpn/status/route.ts     # VPN 状態 API
│   ├── packets/
│   │   ├── page.tsx                # 通信一覧
│   │   └── [id]/page.tsx           # 通信詳細
│   └── page.tsx                    # / → /packets リダイレクト
├── components/
│   ├── PacketTable.tsx
│   ├── PacketDetail.tsx
│   ├── CaptureControl.tsx
│   └── VpnStatusCard.tsx
└── lib/
    ├── db.ts
    ├── sample-data.ts
    ├── capture-state.ts
    └── types.ts
```

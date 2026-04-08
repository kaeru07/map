# NetScope — 通信可視化ダッシュボード

WireGuard VPN 経由の通信メタ情報を可視化する Next.js アプリです。

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

## Supabase セットアップ

### 1. Supabase プロジェクト作成

1. [Supabase](https://supabase.com) でアカウント作成
2. 「New Project」でプロジェクトを作成
3. **Project Settings → Database → Connection String** を開く

### 2. 接続文字列を取得

2種類必要です:

| 変数 | 種別 | 用途 | ポート |
|---|---|---|---|
| `DATABASE_URL` | Transaction Mode (PgBouncer) | アプリのクエリ | 6543 |
| `DIRECT_URL` | Direct Connection | `prisma migrate` | 5432 |

**Transaction Mode (DATABASE_URL):**
```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

**Direct Connection (DIRECT_URL):**
```
postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

---

## Vercel 環境変数の設定

1. Vercel ダッシュボード → Project → **Settings → Environment Variables**
2. 以下を追加:

| Name | Value | 環境 |
|---|---|---|
| `DATABASE_URL` | Transaction Mode の接続文字列 | Production / Preview |
| `DIRECT_URL` | Direct の接続文字列 | Production / Preview (任意) |

> `DATABASE_URL` だけ設定すれば最低限動きます。  
> `DIRECT_URL` は Vercel では使わず、ローカルでの migrate 実行時のみ必要です。

---

## ローカル開発手順

### 初回セットアップ

```bash
# web ディレクトリに移動
cd web

# 依存関係インストール (prisma generate も自動実行)
npm install

# 環境変数を設定
cp .env.example .env
# .env を編集して DATABASE_URL と DIRECT_URL を入力

# Supabase にテーブルを作成 (初回のみ)
npm run db:migrate:deploy
# または
npm run db:push   # migration 履歴不要な場合はこちら

# サンプルデータを投入 (任意)
npm run db:seed

# 開発サーバー起動
npm run dev
```

### DB が手元にない場合 (デモモード)

`.env` に `DATABASE_URL` を設定しなければ、自動的にデモモードで起動します。
サンプルパケット15件が表示されます。

```bash
npm run dev  # DATABASE_URL なしで起動 → デモモード
```

---

## Migration / Schema 手順

### コマンド一覧

| コマンド | 説明 | 使う場面 |
|---|---|---|
| `npm run postinstall` | `prisma generate` を実行 | 自動実行 (npm install 後) |
| `npm run db:push` | スキーマをDBに直接反映 | 初回・試作段階 |
| `npm run db:migrate:dev` | 開発用マイグレーション作成 | スキーマ変更時 (ローカル) |
| `npm run db:migrate:deploy` | マイグレーションを本番に適用 | Supabase への初回 / 追加適用 |
| `npm run db:seed` | サンプルデータを投入 | 開発・テスト時 |
| `npm run db:studio` | Prisma Studio を起動 | データ確認 |

### 環境別の推奨コマンド

| 環境 | コマンド |
|---|---|
| **Supabase 初回** | `npm run db:migrate:deploy` (DIRECT_URL 必須) |
| **Vercel ビルド** | `prisma generate` のみ (postinstall で自動実行) |
| **ローカル試作** | `npm run db:push` (手軽だが履歴なし) |
| **スキーマ変更後** | `npm run db:migrate:dev` → `npm run db:migrate:deploy` |

> **重要**: Vercel のビルドプロセスでは `prisma migrate` は実行しないこと。
> マイグレーションはローカルまたは CI から `DIRECT_URL` を使って手動実行してください。

---

## 404 の直接原因と対策

### これまでの原因

1. `page.tsx` が `null` を返していた → `redirect("/packets")` に変更済み
2. `DATABASE_URL` 未設定で libsql がローカルファイルへのアクセスを試みてクラッシュ → デモモードで回避済み
3. `schema.prisma` に `provider = "sqlite"` が残っており `prisma generate` が異常終了していた可能性 → PostgreSQL に変更済み

### 再発防止

- API routes はすべて `isDemoMode()` チェック + `try/catch` で保護
- `DATABASE_URL` 未設定 → 404 ではなくデモ画面を表示
- DB接続失敗 → 500 ではなくサンプルデータを表示

---

## ディレクトリ構成 (web/)

```
web/
├── app/
│   ├── api/
│   │   ├── packets/route.ts        # GET /api/packets
│   │   ├── packets/[id]/route.ts   # GET /api/packets/:id
│   │   └── stats/route.ts          # GET /api/stats
│   ├── packets/page.tsx            # 通信一覧ページ
│   ├── page.tsx                    # / → /packets リダイレクト
│   └── layout.tsx
├── components/
├── lib/
│   ├── db.ts                       # Prisma + isDemoMode()
│   ├── sample-data.ts              # デモ用サンプルデータ
│   └── types.ts
└── prisma/
    ├── schema.prisma               # PostgreSQL スキーマ
    ├── seed.ts                     # サンプルデータ投入スクリプト
    └── migrations/
        └── 20260409000000_init_postgresql/migration.sql
```

-- =============================================================================
-- migrate_v3.sql — パケット拡張フィールド追加 (v3)
--
-- 実行方法:
--   psql $DATABASE_URL -f scripts/migrate_v3.sql
--   または Supabase SQL Editor に貼り付けて実行
--
-- 既存データは保持されます。新カラムは NULL で追加されます。
-- =============================================================================

-- トランスポートプロトコル (TCP / UDP / ICMP など)
ALTER TABLE packets ADD COLUMN IF NOT EXISTS "transportProto" TEXT;

-- TCP フラグ文字列 (SYN, ACK, FIN,ACK, RST など)
ALTER TABLE packets ADD COLUMN IF NOT EXISTS "tcpFlags" TEXT;

-- UDP データグラム長
ALTER TABLE packets ADD COLUMN IF NOT EXISTS "udpLength" INTEGER;

-- TLS 暗号スイート名 (TLS_AES_128_GCM_SHA256 など)
ALTER TABLE packets ADD COLUMN IF NOT EXISTS "tlsCipher" TEXT;

-- TLS ハンドシェイク種別 (ClientHello / ServerHello など)
ALTER TABLE packets ADD COLUMN IF NOT EXISTS "tlsHandshake" TEXT;

-- HTTP レスポンスステータスコード
ALTER TABLE packets ADD COLUMN IF NOT EXISTS "httpStatus" INTEGER;

-- IP TTL 値
ALTER TABLE packets ADD COLUMN IF NOT EXISTS "ipTtl" INTEGER;

-- IP データグラム長 (IP ヘッダ + ペイロード)
ALTER TABLE packets ADD COLUMN IF NOT EXISTS "ipLen" INTEGER;

-- キャプチャセッション識別子 (ファイル名タイムスタンプ部分)
ALTER TABLE packets ADD COLUMN IF NOT EXISTS "captureSession" TEXT;

-- インデックス
CREATE INDEX IF NOT EXISTS "packets_transportProto_idx" ON packets ("transportProto");
CREATE INDEX IF NOT EXISTS "packets_captureSession_idx" ON packets ("captureSession");
CREATE INDEX IF NOT EXISTS "packets_tlsCipher_idx"      ON packets ("tlsCipher");

-- 確認クエリ
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'packets'
ORDER BY ordinal_position;

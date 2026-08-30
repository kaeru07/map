-- =============================================================================
-- migrate_v4.sql — パケット拡張フィールド追加 (v4)
--
-- 実行方法:
--   psql $DATABASE_URL -f scripts/migrate_v4.sql
--   または Supabase SQL Editor に貼り付けて実行
--
-- 追加内容:
--   ① relativeTime   : セッション開始からの相対時刻 [秒]
--   ② tcpSyn         : TCP SYN フラグ (boolean)
--   ③ tcpFin         : TCP FIN フラグ (boolean)
--   ④ tcpRst         : TCP RST フラグ (boolean)
--   ⑤ isQuicCandidate: QUIC 候補フラグ (UDP + port 443)
--   ⑥ quicFlowId     : QUIC フロー識別子
--   ⑦ tlsSessionId   : TLS セッション ID
--   ⑧ flowId         : 簡易フロー ID (5秒以内の同一 5-tuple をまとめる)
--
-- 既存データは保持されます。新カラムは NULL で追加されます。
-- =============================================================================

-- ① セッション開始からの相対時刻 [秒]
ALTER TABLE packets ADD COLUMN IF NOT EXISTS "relativeTime" DOUBLE PRECISION;

-- ② TCP SYN フラグ
ALTER TABLE packets ADD COLUMN IF NOT EXISTS "tcpSyn" BOOLEAN;

-- ③ TCP FIN フラグ
ALTER TABLE packets ADD COLUMN IF NOT EXISTS "tcpFin" BOOLEAN;

-- ④ TCP RST フラグ
ALTER TABLE packets ADD COLUMN IF NOT EXISTS "tcpRst" BOOLEAN;

-- ⑤ QUIC 候補フラグ (UDP + port 443)
ALTER TABLE packets ADD COLUMN IF NOT EXISTS "isQuicCandidate" BOOLEAN;

-- ⑥ QUIC フロー識別子 (quic.connection_id or 5-tuple ハッシュ)
ALTER TABLE packets ADD COLUMN IF NOT EXISTS "quicFlowId" TEXT;

-- ⑦ TLS セッション ID (ClientHello から取得)
ALTER TABLE packets ADD COLUMN IF NOT EXISTS "tlsSessionId" TEXT;

-- ⑧ 簡易フロー ID (同一 5-tuple × 5 秒以内をまとめる)
ALTER TABLE packets ADD COLUMN IF NOT EXISTS "flowId" TEXT;

-- インデックス
CREATE INDEX IF NOT EXISTS "packets_flowId_idx"           ON packets ("flowId");
CREATE INDEX IF NOT EXISTS "packets_isQuicCandidate_idx"  ON packets ("isQuicCandidate");
CREATE INDEX IF NOT EXISTS "packets_tcpSyn_idx"           ON packets ("tcpSyn");
CREATE INDEX IF NOT EXISTS "packets_captureSession_relativeTime_idx"
  ON packets ("captureSession", "relativeTime");

-- 確認クエリ (v4 追加分のみ)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'packets'
  AND column_name IN (
    'relativeTime', 'tcpSyn', 'tcpFin', 'tcpRst',
    'isQuicCandidate', 'quicFlowId', 'tlsSessionId', 'flowId'
  )
ORDER BY ordinal_position;

-- CreateTable
CREATE TABLE "packets" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "srcIp" TEXT NOT NULL,
    "dstIp" TEXT NOT NULL,
    "srcPort" INTEGER,
    "dstPort" INTEGER,
    "protocol" TEXT NOT NULL,
    "bytes" INTEGER,
    "direction" TEXT,
    "hostName" TEXT,
    "tlsSni" TEXT,
    "dnsQuery" TEXT,
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: timestamp DESC クエリ用（最重要）
CREATE INDEX "packets_timestamp_idx" ON "packets"("timestamp");

-- CreateIndex: protocol フィルタ用
CREATE INDEX "packets_protocol_idx" ON "packets"("protocol");

-- CreateIndex: 特定宛先の時系列クエリ用（複合）
CREATE INDEX "packets_dstIp_timestamp_idx" ON "packets"("dstIp", "timestamp");

-- CreateIndex: dstPort フィルタ用（443, 53 等）
CREATE INDEX "packets_dstPort_idx" ON "packets"("dstPort");

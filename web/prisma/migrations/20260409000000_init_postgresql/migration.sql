-- CreateTable
CREATE TABLE "Packet" (
    "id" SERIAL NOT NULL,
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
    "rawJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Packet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Packet_timestamp_idx" ON "Packet"("timestamp");

-- CreateIndex
CREATE INDEX "Packet_protocol_idx" ON "Packet"("protocol");

-- CreateIndex
CREATE INDEX "Packet_srcIp_idx" ON "Packet"("srcIp");

-- CreateIndex
CREATE INDEX "Packet_dstIp_idx" ON "Packet"("dstIp");

-- CreateIndex
CREATE INDEX "Packet_dstPort_idx" ON "Packet"("dstPort");

-- CreateTable
CREATE TABLE "Packet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" DATETIME NOT NULL,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Packet_timestamp_idx" ON "Packet"("timestamp");

-- CreateIndex
CREATE INDEX "Packet_protocol_idx" ON "Packet"("protocol");

-- CreateIndex
CREATE INDEX "Packet_srcIp_idx" ON "Packet"("srcIp");

-- CreateIndex
CREATE INDEX "Packet_dstIp_idx" ON "Packet"("dstIp");

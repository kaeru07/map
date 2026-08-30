import { NextRequest } from "next/server";
import { isDemoMode, prisma } from "@/lib/db";
import { filterSamplePackets } from "@/lib/sample-data";
import { Prisma } from "@/app/generated/prisma/client";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(
    5000,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? "100", 10))
  );
  const protocol = searchParams.get("protocol");
  const srcIp = searchParams.get("srcIp");
  const dstIp = searchParams.get("dstIp");
  const dstPort = searchParams.get("dstPort");
  const timeFrom = searchParams.get("timeFrom");
  const timeTo = searchParams.get("timeTo");
  const search = searchParams.get("search");

  // 環境変数未設定 → デモモード
  if (isDemoMode()) {
    const { packets, total } = filterSamplePackets({
      protocol, srcIp, dstIp, dstPort, timeFrom, timeTo, search,
      page, pageSize,
    });
    return Response.json({
      packets, total, page, pageSize,
      demo: true,
      demoReason: "no_db_config", // DIRECT_URL / DATABASE_URL が未設定
    });
  }

  try {
    const where: Prisma.PacketWhereInput = {};

    if (protocol) where.protocol = protocol;
    if (srcIp) where.srcIp = { contains: srcIp };
    if (dstIp) where.dstIp = { contains: dstIp };
    if (dstPort) where.dstPort = parseInt(dstPort, 10);
    if (timeFrom || timeTo) {
      where.timestamp = {};
      if (timeFrom) where.timestamp.gte = new Date(timeFrom);
      if (timeTo) where.timestamp.lte = new Date(timeTo);
    }
    if (search) {
      where.OR = [
        { srcIp:      { contains: search } },
        { dstIp:      { contains: search } },
        { hostName:   { contains: search } },
        { tlsSni:     { contains: search } },
        { dnsQuery:   { contains: search } },
        { dnsResp:    { contains: search } },
        { httpPath:   { contains: search } },
      ];
    }

    const [packets, total] = await Promise.all([
      prisma.packet.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.packet.count({ where }),
    ]);

    const serialized = packets.map((p) => ({
      ...p,
      timestamp: p.timestamp.toISOString(),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));

    return Response.json({ packets: serialized, total, page, pageSize });

  } catch (err) {
    // DB 接続エラー → サンプルデータでフォールバック
    const reason = err instanceof Error ? err.message : String(err);
    console.error("[packets API] DB error, falling back to sample data:", reason);

    const { packets, total } = filterSamplePackets({
      protocol, srcIp, dstIp, dstPort, timeFrom, timeTo, search,
      page, pageSize,
    });
    return Response.json({
      packets, total, page, pageSize,
      demo: true,
      demoReason: "db_error",  // DB 接続失敗
      demoError: reason,        // エラーの詳細（デバッグ用）
    });
  }
}

import { isDemoMode, prisma } from "@/lib/db";
import { SAMPLE_STATS } from "@/lib/sample-data";

export async function GET() {
  if (isDemoMode()) {
    return Response.json(SAMPLE_STATS);
  }

  try {
    const [total, protocols, latest] = await Promise.all([
      prisma.packet.count(),
      prisma.packet.findMany({
        select: { protocol: true },
        distinct: ["protocol"],
      }),
      prisma.packet.findFirst({
        orderBy: { timestamp: "desc" },
        select: { timestamp: true },
      }),
    ]);

    return Response.json({
      total,
      protocols: protocols.map((p) => p.protocol),
      latestTimestamp: latest?.timestamp.toISOString() ?? null,
    });
  } catch {
    return Response.json(SAMPLE_STATS);
  }
}

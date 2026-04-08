import { prisma } from "@/lib/db";

export async function GET() {
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
}

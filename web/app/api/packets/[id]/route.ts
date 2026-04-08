import { NextRequest } from "next/server";
import { isDemoMode, prisma } from "@/lib/db";
import { SAMPLE_PACKETS } from "@/lib/sample-data";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numId = parseInt(id, 10);

  if (isDemoMode()) {
    const packet = SAMPLE_PACKETS.find((p) => p.id === numId);
    if (!packet) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ ...packet, demo: true });
  }

  try {
    const packet = await prisma.packet.findUnique({
      where: { id: numId },
    });

    if (!packet) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({
      ...packet,
      timestamp: packet.timestamp.toISOString(),
      createdAt: packet.createdAt.toISOString(),
    });
  } catch {
    return Response.json(
      { error: "データベース接続エラー" },
      { status: 503 }
    );
  }
}

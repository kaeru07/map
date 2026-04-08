import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const packet = await prisma.packet.findUnique({
    where: { id: parseInt(id, 10) },
  });

  if (!packet) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({
    ...packet,
    timestamp: packet.timestamp.toISOString(),
    createdAt: packet.createdAt.toISOString(),
  });
}

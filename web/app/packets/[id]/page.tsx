import { notFound } from "next/navigation";
import { isDemoMode, prisma } from "@/lib/db";
import { SAMPLE_PACKETS } from "@/lib/sample-data";
import { ProtocolBadge } from "@/components/ProtocolBadge";
import Link from "next/link";

export default async function PacketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // デモモード: サンプルデータから検索
  if (isDemoMode()) {
    const demo = SAMPLE_PACKETS.find((p) => p.id === id);
    if (!demo) notFound();
    return <DetailView packet={{ ...demo, rawJson: null }} />;
  }

  // 本番モード: Prisma で取得
  let packet;
  try {
    packet = await prisma.packet.findUnique({ where: { id } });
  } catch {
    notFound();
  }
  if (!packet) notFound();

  return <DetailView packet={packet} />;
}

type ViewPacket = {
  id: string | number;
  timestamp: Date | string;
  protocol: string;
  srcIp: string;
  srcPort: number | null;
  dstIp: string;
  dstPort: number | null;
  bytes: number | null;
  direction: string | null;
  hostName: string | null;
  tlsSni: string | null;
  dnsQuery: string | null;
  createdAt: Date | string;
  rawJson: unknown;
};

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="flex gap-2 py-2 border-b border-slate-800 last:border-0">
      <span className="text-slate-500 text-xs w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-slate-200 font-mono text-sm break-all">{String(value)}</span>
    </div>
  );
}

function DetailView({ packet }: { packet: ViewPacket }) {
  const ts =
    packet.timestamp instanceof Date
      ? packet.timestamp.toLocaleString("ja-JP")
      : new Date(packet.timestamp).toLocaleString("ja-JP");

  const createdTs =
    packet.createdAt instanceof Date
      ? packet.createdAt.toLocaleString("ja-JP")
      : new Date(packet.createdAt).toLocaleString("ja-JP");

  // rawJson は Prisma Json 型 (already parsed) または null
  const rawJsonStr = packet.rawJson
    ? JSON.stringify(packet.rawJson, null, 2)
    : null;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/packets"
          className="text-slate-400 hover:text-slate-100 text-sm transition-colors"
        >
          ← 一覧に戻る
        </Link>
        <ProtocolBadge protocol={packet.protocol} />
        <span className="text-slate-400 text-sm font-mono">#{packet.id}</span>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-900 divide-y divide-slate-800 overflow-hidden">
        <div className="px-4 py-3 text-xs text-slate-400 uppercase tracking-wider bg-slate-800/60">
          通信詳細
        </div>
        <div className="p-4">
          <Row label="ID" value={String(packet.id)} />
          <Row label="Timestamp" value={ts} />
          <Row label="Protocol" value={packet.protocol} />
          <Row label="Src IP" value={packet.srcIp} />
          <Row label="Src Port" value={packet.srcPort} />
          <Row label="Dst IP" value={packet.dstIp} />
          <Row label="Dst Port" value={packet.dstPort} />
          <Row label="Bytes" value={packet.bytes !== null && packet.bytes !== undefined ? `${packet.bytes} bytes` : null} />
          <Row label="Direction" value={packet.direction} />
          <Row label="Host Name" value={packet.hostName} />
          <Row label="TLS SNI" value={packet.tlsSni} />
          <Row label="DNS Query" value={packet.dnsQuery} />
          <Row label="Created At" value={createdTs} />
        </div>
      </div>

      {rawJsonStr && (
        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900 overflow-hidden">
          <div className="px-4 py-3 text-xs text-slate-400 uppercase tracking-wider bg-slate-800/60">
            Raw JSON
          </div>
          <pre className="p-4 text-xs text-green-300 font-mono overflow-x-auto whitespace-pre-wrap break-all">
            {rawJsonStr}
          </pre>
        </div>
      )}
    </div>
  );
}

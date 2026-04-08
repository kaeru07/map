import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProtocolBadge } from "@/components/ProtocolBadge";
import Link from "next/link";

export default async function PacketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) notFound();

  const packet = await prisma.packet.findUnique({ where: { id: numId } });
  if (!packet) notFound();

  const parsed = (() => {
    if (!packet.rawJson) return null;
    try {
      return JSON.parse(packet.rawJson);
    } catch {
      return null;
    }
  })();

  function Row({ label, value }: { label: string; value: string | number | null }) {
    if (value === null || value === undefined) return null;
    return (
      <div className="flex gap-2 py-2 border-b border-slate-800 last:border-0">
        <span className="text-slate-500 text-xs w-32 shrink-0 pt-0.5">{label}</span>
        <span className="text-slate-200 font-mono text-sm break-all">{String(value)}</span>
      </div>
    );
  }

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
          <Row label="ID" value={packet.id} />
          <Row label="Timestamp" value={packet.timestamp.toLocaleString("ja-JP")} />
          <Row label="Protocol" value={packet.protocol} />
          <Row label="Src IP" value={packet.srcIp} />
          <Row label="Src Port" value={packet.srcPort} />
          <Row label="Dst IP" value={packet.dstIp} />
          <Row label="Dst Port" value={packet.dstPort} />
          <Row label="Bytes" value={packet.bytes !== null ? `${packet.bytes} bytes` : null} />
          <Row label="Direction" value={packet.direction} />
          <Row label="Host Name" value={packet.hostName} />
          <Row label="TLS SNI" value={packet.tlsSni} />
          <Row label="DNS Query" value={packet.dnsQuery} />
          <Row label="Created At" value={packet.createdAt.toLocaleString("ja-JP")} />
        </div>
      </div>

      {packet.rawJson && (
        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900 overflow-hidden">
          <div className="px-4 py-3 text-xs text-slate-400 uppercase tracking-wider bg-slate-800/60">
            Raw JSON
          </div>
          <pre className="p-4 text-xs text-green-300 font-mono overflow-x-auto whitespace-pre-wrap break-all">
            {parsed ? JSON.stringify(parsed, null, 2) : packet.rawJson}
          </pre>
        </div>
      )}
    </div>
  );
}

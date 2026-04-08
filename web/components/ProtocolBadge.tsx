import { PROTOCOL_BG } from "@/lib/types";

export function ProtocolBadge({ protocol }: { protocol: string }) {
  const cls = PROTOCOL_BG[protocol.toUpperCase()] ?? "bg-gray-400/10 text-gray-300 border-gray-400/30";
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-mono font-semibold ${cls}`}
    >
      {protocol}
    </span>
  );
}

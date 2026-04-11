"use client";

import { Packet, isVpnIp, VPN_CLIENT_NAMES } from "@/lib/types";
import { ProtocolBadge } from "./ProtocolBadge";

function VpnLabel({ ip }: { ip: string }) {
  if (!isVpnIp(ip)) return null;
  const name = VPN_CLIENT_NAMES[ip];
  return (
    <span className="inline-flex items-center rounded px-1 py-0.5 text-[10px] font-medium bg-purple-950 border border-purple-700 text-purple-300 leading-none mr-0.5">
      VPN{name ? ` ${name}` : ""}
    </span>
  );
}

function fmtBytes(b: number | null) {
  if (b === null) return "—";
  if (b < 1024) return `${b} B`;
  return `${(b / 1024).toFixed(1)} KB`;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Short time for mobile cards (HH:MM:SS only) */
function fmtTimeShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

type Props = {
  packets: Packet[];
  selectedId: string | null;
  onSelect: (p: Packet) => void;
  loading?: boolean;
};

export function PacketTable({ packets, selectedId, onSelect, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 md:py-20 text-slate-500">
        <div className="animate-spin mr-2 h-4 w-4 border-2 border-slate-500 border-t-blue-400 rounded-full" />
        読み込み中…
      </div>
    );
  }

  if (packets.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 md:py-20 text-slate-500">
        データがありません
      </div>
    );
  }

  return (
    <>
      {/* ── Mobile card list (< md: 768px) ── */}
      <div className="md:hidden divide-y divide-slate-800">
        {packets.map((p) => {
          const host = p.tlsSni ?? p.hostName ?? p.dnsQuery;
          const isSelected = selectedId === p.id;
          return (
            <div
              key={p.id}
              onClick={() => onSelect(p)}
              className={`px-3 py-2.5 cursor-pointer transition-colors hover:bg-slate-700/40 ${
                isSelected
                  ? "bg-slate-700/60 border-l-2 border-l-blue-500 pl-2.5"
                  : ""
              }`}
            >
              {/* Top row: protocol badge + direction + time */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <ProtocolBadge protocol={p.protocol} />
                  {p.direction === "outbound" ? (
                    <span className="text-blue-400 text-xs font-mono">↑</span>
                  ) : p.direction === "inbound" ? (
                    <span className="text-green-400 text-xs font-mono">↓</span>
                  ) : null}
                </div>
                <span className="text-[11px] text-slate-500 font-mono shrink-0">
                  {fmtTimeShort(p.timestamp)}
                </span>
              </div>

              {/* IP row: src → dst */}
              <div className="mt-0.5 flex items-center gap-1 text-xs font-mono text-slate-300 overflow-hidden">
                <VpnLabel ip={p.srcIp} />
                <span className="truncate">
                  {p.srcIp}
                  {p.srcPort ? (
                    <span className="text-slate-500">:{p.srcPort}</span>
                  ) : null}
                </span>
                <span className="text-slate-600 shrink-0 mx-0.5">→</span>
                <VpnLabel ip={p.dstIp} />
                <span className="truncate">
                  {p.dstIp}
                  {p.dstPort ? (
                    <span className="text-slate-500">:{p.dstPort}</span>
                  ) : null}
                </span>
              </div>

              {/* Host / SNI / DNS (optional) */}
              {host && (
                <div className="mt-0.5 text-[11px] text-slate-500 truncate">{host}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Desktop table (md+: 768px) ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-xs text-slate-400 uppercase tracking-wider">
              <th className="py-2 px-3 text-left font-medium">時刻</th>
              <th className="py-2 px-3 text-left font-medium">プロトコル</th>
              <th className="py-2 px-3 text-left font-medium">送信元</th>
              <th className="py-2 px-3 text-left font-medium">宛先</th>
              <th className="py-2 px-3 text-left font-medium">ホスト / SNI / DNS</th>
              <th className="py-2 px-3 text-right font-medium">サイズ</th>
              <th className="py-2 px-3 text-left font-medium">方向</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {packets.map((p) => (
              <tr
                key={p.id}
                onClick={() => onSelect(p)}
                className={`cursor-pointer transition-colors hover:bg-slate-700/40 ${
                  selectedId === p.id
                    ? "bg-slate-700/60 border-l-2 border-l-blue-500"
                    : ""
                }`}
              >
                <td className="py-1.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                  {fmtTime(p.timestamp)}
                </td>
                <td className="py-1.5 px-3 whitespace-nowrap">
                  <ProtocolBadge protocol={p.protocol} />
                </td>
                <td className="py-1.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                  <VpnLabel ip={p.srcIp} />
                  <span>{p.srcIp}</span>
                  {p.srcPort && (
                    <span className="text-slate-500">:{p.srcPort}</span>
                  )}
                </td>
                <td className="py-1.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                  <VpnLabel ip={p.dstIp} />
                  <span>{p.dstIp}</span>
                  {p.dstPort && (
                    <span className="text-slate-500">:{p.dstPort}</span>
                  )}
                </td>
                <td className="py-1.5 px-3 text-slate-400 max-w-[220px] truncate">
                  {p.tlsSni ?? p.hostName ?? p.dnsQuery ?? (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="py-1.5 px-3 font-mono text-slate-400 text-right whitespace-nowrap">
                  {fmtBytes(p.bytes)}
                </td>
                <td className="py-1.5 px-3 text-slate-500 whitespace-nowrap">
                  {p.direction === "outbound" ? (
                    <span className="text-blue-400">↑ out</span>
                  ) : p.direction === "inbound" ? (
                    <span className="text-green-400">↓ in</span>
                  ) : (
                    <span>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

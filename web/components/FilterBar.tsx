"use client";

import { PacketFilters } from "@/lib/types";

const PROTOCOLS = ["", "TCP", "UDP", "DNS", "TLS", "HTTP", "HTTPS", "ICMP", "ARP"];

type Props = {
  filters: PacketFilters;
  onChange: (f: PacketFilters) => void;
};

export function FilterBar({ filters, onChange }: Props) {
  function set(key: keyof PacketFilters, value: string) {
    onChange({ ...filters, [key]: value || undefined });
  }

  return (
    <div className="flex flex-wrap gap-2 rounded-lg border border-slate-700 bg-slate-800/60 p-3">
      {/* Search */}
      <input
        type="text"
        placeholder="IP / ホスト / SNI / DNS を検索"
        value={filters.search ?? ""}
        onChange={(e) => set("search", e.target.value)}
        className="flex-1 min-w-[200px] rounded border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      {/* Protocol */}
      <select
        value={filters.protocol ?? ""}
        onChange={(e) => set("protocol", e.target.value)}
        className="rounded border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {PROTOCOLS.map((p) => (
          <option key={p} value={p}>
            {p || "全プロトコル"}
          </option>
        ))}
      </select>

      {/* Dst IP */}
      <input
        type="text"
        placeholder="宛先 IP"
        value={filters.dstIp ?? ""}
        onChange={(e) => set("dstIp", e.target.value)}
        className="w-36 rounded border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      {/* Dst Port */}
      <input
        type="text"
        placeholder="宛先ポート"
        value={filters.dstPort ?? ""}
        onChange={(e) => set("dstPort", e.target.value)}
        className="w-28 rounded border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      {/* Time from */}
      <input
        type="datetime-local"
        value={filters.timeFrom ?? ""}
        onChange={(e) => set("timeFrom", e.target.value)}
        className="rounded border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <span className="self-center text-slate-500 text-sm">〜</span>
      <input
        type="datetime-local"
        value={filters.timeTo ?? ""}
        onChange={(e) => set("timeTo", e.target.value)}
        className="rounded border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      {/* Clear */}
      <button
        onClick={() => onChange({})}
        className="rounded border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-600 transition-colors"
      >
        クリア
      </button>
    </div>
  );
}

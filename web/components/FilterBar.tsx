"use client";

import { useState } from "react";
import { PacketFilters } from "@/lib/types";

const PROTOCOLS = ["", "TCP", "UDP", "DNS", "TLS", "HTTP", "HTTPS", "ICMP", "ARP"];

type Props = {
  filters: PacketFilters;
  onChange: (f: PacketFilters) => void;
};

export function FilterBar({ filters, onChange }: Props) {
  const [showDate, setShowDate] = useState(false);

  function set(key: keyof PacketFilters, value: string) {
    onChange({ ...filters, [key]: value || undefined });
  }

  const hasDateFilter = !!(filters.timeFrom || filters.timeTo);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-slate-800/60 p-3">
      {/* Row 1: Search + Clear (always visible) */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="IP / ホスト / SNI / DNS を検索"
          value={filters.search ?? ""}
          onChange={(e) => set("search", e.target.value)}
          className="flex-1 min-w-0 rounded border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={() => { onChange({}); setShowDate(false); }}
          className="shrink-0 rounded border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-600 transition-colors"
        >
          クリア
        </button>
      </div>

      {/* Row 2: Protocol + IP + Port + Date toggle (horizontally scrollable on mobile) */}
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {/* Protocol */}
        <select
          value={filters.protocol ?? ""}
          onChange={(e) => set("protocol", e.target.value)}
          className="shrink-0 rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          placeholder="宛先IP"
          value={filters.dstIp ?? ""}
          onChange={(e) => set("dstIp", e.target.value)}
          className="shrink-0 w-28 rounded border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        {/* Dst Port */}
        <input
          type="text"
          placeholder="Port"
          value={filters.dstPort ?? ""}
          onChange={(e) => set("dstPort", e.target.value)}
          className="shrink-0 w-20 rounded border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        {/* Date range toggle — shows indicator dot when active */}
        <button
          onClick={() => setShowDate((v) => !v)}
          className={`shrink-0 inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs transition-colors ${
            showDate || hasDateFilter
              ? "border-blue-700 bg-blue-950 text-blue-300"
              : "border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700"
          }`}
        >
          {hasDateFilter && !showDate && (
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
          )}
          期間{showDate ? " ▲" : " ▼"}
        </button>
      </div>

      {/* Row 3: Date range (collapsible) */}
      {showDate && (
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="datetime-local"
            value={filters.timeFrom ?? ""}
            onChange={(e) => set("timeFrom", e.target.value)}
            className="rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-slate-500 text-sm">〜</span>
          <input
            type="datetime-local"
            value={filters.timeTo ?? ""}
            onChange={(e) => set("timeTo", e.target.value)}
            className="rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  );
}

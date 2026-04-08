"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Packet, PacketFilters, PacketsResponse } from "@/lib/types";
import { StatsCards } from "@/components/StatsCards";
import { FilterBar } from "@/components/FilterBar";
import { PacketTable } from "@/components/PacketTable";
import { PacketDetail } from "@/components/PacketDetail";

const PAGE_SIZE = 100;

export default function PacketsPage() {
  const [filters, setFilters] = useState<PacketFilters>({});
  const [packets, setPackets] = useState<Packet[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Packet | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  const fetchPackets = useCallback(
    async (f: PacketFilters, p: number) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(p));
        params.set("pageSize", String(PAGE_SIZE));
        if (f.protocol) params.set("protocol", f.protocol);
        if (f.srcIp) params.set("srcIp", f.srcIp);
        if (f.dstIp) params.set("dstIp", f.dstIp);
        if (f.dstPort) params.set("dstPort", f.dstPort);
        if (f.timeFrom) params.set("timeFrom", f.timeFrom);
        if (f.timeTo) params.set("timeTo", f.timeTo);
        if (f.search) params.set("search", f.search);

        const res = await fetch(`/api/packets?${params}`, {
          signal: ctrl.signal,
        });
        const data: PacketsResponse = await res.json();
        setPackets(data.packets);
        setTotal(data.total);
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== "AbortError") console.error(e);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    setPage(1);
    fetchPackets(filters, 1);
  }, [filters, fetchPackets, refreshKey]);

  useEffect(() => {
    if (page === 1) return;
    fetchPackets(filters, page);
  }, [page, filters, fetchPackets]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-3">
      {/* Stats */}
      <StatsCards refreshKey={refreshKey} />

      {/* Filter + Refresh */}
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <FilterBar filters={filters} onChange={setFilters} />
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="shrink-0 rounded border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors mt-0"
          title="最新データに更新"
        >
          ↻ 更新
        </button>
      </div>

      {/* Count */}
      <div className="text-xs text-slate-500">
        {loading ? "読み込み中…" : `${total.toLocaleString()} 件`}
        {total > PAGE_SIZE && !loading && ` (ページ ${page} / ${totalPages})`}
      </div>

      {/* Main: table + detail panel */}
      <div className="flex gap-3">
        {/* Table */}
        <div
          className={`flex-1 min-w-0 rounded-lg border border-slate-700 bg-slate-900 overflow-hidden transition-all ${
            selected ? "hidden lg:block" : ""
          }`}
        >
          <PacketTable
            packets={packets}
            selectedId={selected?.id ?? null}
            onSelect={(p) => setSelected(p)}
            loading={loading}
          />
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800 text-sm text-slate-400">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="disabled:opacity-40 hover:text-slate-100 transition-colors"
              >
                ← 前
              </button>
              <span>
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="disabled:opacity-40 hover:text-slate-100 transition-colors"
              >
                次 →
              </button>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-full lg:w-[420px] shrink-0 rounded-lg border border-slate-700 bg-slate-900 overflow-hidden">
            <PacketDetail
              packet={selected}
              onClose={() => setSelected(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Packet, PacketFilters, PacketsResponse } from "@/lib/types";
import { StatsCards } from "@/components/StatsCards";
import { FilterBar } from "@/components/FilterBar";
import { PacketTable } from "@/components/PacketTable";
import { PacketDetail } from "@/components/PacketDetail";
import { CaptureControl } from "@/components/CaptureControl";
import { VpnStatusCard } from "@/components/VpnStatusCard";
import { isVpnIp } from "@/lib/types";

const PAGE_SIZE = 100;

export default function PacketsPage() {
  const [filters, setFilters] = useState<PacketFilters>({});
  const [packets, setPackets] = useState<Packet[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Packet | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [vpnOnly, setVpnOnly] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const fetchPackets = useCallback(
    async (f: PacketFilters, p: number) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setLoading(true);
      setError(null);
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
        if (!res.ok) {
          throw new Error(`サーバーエラー: ${res.status} ${res.statusText}`);
        }
        const data: PacketsResponse = await res.json();
        setPackets(data.packets);
        setTotal(data.total);
        setIsDemo(!!data.demo);
        setLastUpdated(new Date());
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== "AbortError") {
          setError(e.message || "データの取得に失敗しました");
        }
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

  const displayPackets = vpnOnly
    ? packets.filter((p) => isVpnIp(p.srcIp) || isVpnIp(p.dstIp))
    : packets;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function fmtTime(d: Date) {
    return d.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  return (
    <div className="flex flex-col gap-2 md:gap-3">
      {/* VPN status — collapsed by default on mobile */}
      <VpnStatusCard refreshKey={refreshKey} />

      {/* Capture control — collapsed by default on mobile */}
      <CaptureControl onRefresh={() => setRefreshKey((k) => k + 1)} />

      {/* Stats */}
      <StatsCards refreshKey={refreshKey} />

      {/* Filter + Refresh row */}
      <div className="flex items-start gap-2">
        {/* Filter bar takes all remaining width */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <FilterBar
            filters={filters}
            onChange={(f) => {
              setFilters(f);
              setSelected(null);
            }}
          />
          {/* VPN-only toggle */}
          <button
            onClick={() => setVpnOnly((v) => !v)}
            className={`self-start inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
              vpnOnly
                ? "border-purple-700 bg-purple-950 text-purple-300 hover:bg-purple-900"
                : "border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {vpnOnly ? "VPN通信のみ" : "全通信"}
          </button>
        </div>

        {/* Refresh button */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            className="rounded border border-slate-600 bg-slate-800 px-3 md:px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors min-h-[36px]"
            title="最新データに更新"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <span className="animate-spin inline-block h-3 w-3 border border-slate-400 border-t-blue-400 rounded-full" />
                <span className="hidden sm:inline">読込中</span>
              </span>
            ) : (
              "↻ 更新"
            )}
          </button>
          {lastUpdated && (
            <span className="text-[10px] text-slate-600">
              {fmtTime(lastUpdated)}
            </span>
          )}
        </div>
      </div>

      {/* Demo mode banner */}
      {isDemo && (
        <div className="rounded-lg border border-yellow-700 bg-yellow-950/40 px-3 py-2 text-xs md:text-sm text-yellow-300">
          <span className="font-semibold">⚠ デモモード</span>
          {" — "}DATABASE_URL 未設定のためサンプルデータを表示中。
          <span className="hidden sm:inline">
            本番環境では Vercel の Environment Variables に{" "}
            <code className="font-mono text-yellow-200">DATABASE_URL</code>{" "}
            を設定してください。
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/50 px-3 py-2.5 text-sm text-red-300">
          <span className="font-semibold">エラー: </span>{error}
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="ml-3 underline hover:text-red-100"
          >
            再試行
          </button>
        </div>
      )}

      {/* Count */}
      {!error && (
        <div className="text-xs text-slate-500 h-4">
          {loading
            ? ""
            : total === 0
            ? "データなし"
            : `${total.toLocaleString()} 件${
                total > PAGE_SIZE ? ` (${page} / ${totalPages} ページ)` : ""
              }`}
        </div>
      )}

      {/* Main: table/cards + detail panel */}
      <div className="flex gap-2 md:gap-3">
        {/* Table / Card list */}
        <div
          className={`flex-1 min-w-0 rounded-lg border border-slate-700 bg-slate-900 overflow-hidden transition-all ${
            selected ? "hidden lg:block" : ""
          }`}
        >
          <PacketTable
            packets={displayPackets}
            selectedId={selected?.id ?? null}
            onSelect={(p) => setSelected(p)}
            loading={loading}
          />

          {/* Pagination */}
          {totalPages > 1 && !loading && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800 text-sm text-slate-400">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="disabled:opacity-40 hover:text-slate-100 transition-colors px-2 py-1"
              >
                ← 前
              </button>
              <span className="text-xs">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="disabled:opacity-40 hover:text-slate-100 transition-colors px-2 py-1"
              >
                次 →
              </button>
            </div>
          )}
        </div>

        {/* Detail panel: full screen on < lg, side panel on lg+ */}
        {selected && (
          <div className="w-full lg:w-[420px] shrink-0 rounded-lg border border-slate-700 bg-slate-900 overflow-hidden">
            <PacketDetail packet={selected} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>
    </div>
  );
}

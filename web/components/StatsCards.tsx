"use client";

import { useEffect, useState } from "react";
import { StatsResponse } from "@/lib/types";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function StatsCards({ refreshKey }: { refreshKey: number }) {
  const [stats, setStats] = useState<StatsResponse | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, [refreshKey]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3">
      {/* 総通信件数 — most important, full width on portrait, normal on sm+ */}
      <div className="col-span-2 sm:col-span-1 rounded-lg border border-slate-700 bg-slate-800/60 p-3 md:p-4">
        <p className="text-[10px] md:text-xs text-slate-400 uppercase tracking-wider">総通信件数</p>
        <p className="mt-0.5 md:mt-1 text-xl md:text-2xl font-mono font-bold text-slate-100">
          {stats ? stats.total.toLocaleString() : "—"}
        </p>
      </div>
      <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3 md:p-4">
        <p className="text-[10px] md:text-xs text-slate-400 uppercase tracking-wider">プロトコル</p>
        <p className="mt-0.5 md:mt-1 text-xl md:text-2xl font-mono font-bold text-slate-100">
          {stats ? stats.protocols.length : "—"}
        </p>
        {stats && stats.protocols.length > 0 && (
          <p className="mt-0.5 text-[10px] md:text-xs text-slate-500 font-mono truncate">
            {stats.protocols.join(" · ")}
          </p>
        )}
      </div>
      <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3 md:p-4">
        <p className="text-[10px] md:text-xs text-slate-400 uppercase tracking-wider">直近の通信</p>
        <p className="mt-0.5 md:mt-1 text-sm md:text-lg font-mono font-bold text-slate-100 leading-tight">
          {stats ? formatDate(stats.latestTimestamp) : "—"}
        </p>
      </div>
    </div>
  );
}

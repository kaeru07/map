"use client";

import { useEffect, useState } from "react";
import { VpnStatusResponse } from "@/lib/types";

function ConnectedBadge({ connected }: { connected: boolean }) {
  return connected ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-green-700 bg-green-950 px-2 py-0.5 text-xs font-medium text-green-300">
      <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
      接続中
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
      未接続
    </span>
  );
}

export function VpnStatusCard({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<VpnStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(true); // collapsed by default on mobile

  useEffect(() => {
    setLoading(true);
    fetch("/api/vpn/status")
      .then((r) => r.json())
      .then((d: VpnStatusResponse) => setData(d))
      .catch(() => setData({ clients: [], error: "取得失敗" }))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const connectedCount = data?.clients.filter((c) => c.connected).length ?? 0;
  const totalCount = data?.clients.length ?? 0;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 md:p-4">
      {/* Header row — always visible, tap to toggle on mobile */}
      <button
        className="w-full flex items-center gap-3 text-left"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
      >
        <span className="text-sm font-semibold text-slate-300">VPN 状態</span>
        <span className="font-mono text-xs text-slate-500">wg0 · 10.0.0.0/24</span>
        {!loading && (
          <span className="ml-auto text-xs text-slate-500 flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                connectedCount > 0 ? "bg-green-400" : "bg-slate-500"
              }`}
            />
            {connectedCount}/{totalCount} 接続
            <span className="text-slate-600 text-[10px]">{collapsed ? "▼" : "▲"}</span>
          </span>
        )}
        {loading && (
          <span className="ml-auto inline-block h-3 w-3 animate-spin rounded-full border border-slate-500 border-t-blue-400" />
        )}
      </button>

      {/* Collapsible body */}
      {!collapsed && (
        <div className="mt-3">
          {!loading && data?.error && (
            <div className="text-xs text-red-400 py-1">
              ⚠ {data.error}
              {data.error.includes("wg") && (
                <span className="text-slate-500 ml-1">(VPS 上でのみ表示されます)</span>
              )}
            </div>
          )}

          {!loading && data && data.clients.length === 0 && !data.error && (
            <div className="text-xs text-slate-500 py-1">ピアが登録されていません</div>
          )}

          {!loading && data && data.clients.length > 0 && (
            <div className="flex flex-col gap-2">
              {data.clients.map((client) => (
                <div
                  key={client.ip}
                  className="rounded border border-slate-700 bg-slate-800/60 px-3 py-2 flex flex-wrap gap-x-3 gap-y-1 items-center"
                >
                  {/* Name + IP + badge */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-slate-200">{client.name}</span>
                    <span className="font-mono text-xs text-slate-500">{client.ip}</span>
                    <ConnectedBadge connected={client.connected} />
                  </div>

                  {/* Detail — hidden on small mobile, visible on sm+ */}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400 sm:ml-auto">
                    <span>
                      <span className="text-slate-600">hs </span>
                      {client.handshake}
                    </span>
                    <span>
                      <span className="text-slate-600">↓ </span>
                      <span className="font-mono text-green-400">{client.rx}</span>
                    </span>
                    <span>
                      <span className="text-slate-600">↑ </span>
                      <span className="font-mono text-blue-400">{client.tx}</span>
                    </span>
                    {client.endpoint && (
                      <span className="font-mono text-slate-500 truncate max-w-[160px] hidden sm:inline">
                        {client.endpoint}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

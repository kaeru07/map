"use client";

import { useCallback, useEffect, useState } from "react";

interface CaptureStatus {
  running: boolean;
  pid: number | null;
  lastStartedAt: string | null;
  lastImportedAt: string | null;
  lastMessage: string | null;
}

interface Alert {
  type: "success" | "error";
  message: string;
}

interface CaptureControlProps {
  onRefresh?: () => void;
}

function fmtDatetime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function CaptureControl({ onRefresh }: CaptureControlProps) {
  const [status, setStatus] = useState<CaptureStatus | null>(null);
  const [loading, setLoading] = useState<"start" | "stop" | "import" | "refresh" | null>(null);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/capture/status");
      if (res.ok) setStatus(await res.json());
    } catch {
      // ignored
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  async function handleStart() {
    setLoading("start");
    setAlert(null);
    try {
      const res = await fetch("/api/capture/start", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setAlert({ type: "success", message: "キャプチャを開始しました" });
        await fetchStatus();
      } else {
        setAlert({ type: "error", message: data.error ?? "開始に失敗しました" });
      }
    } catch {
      setAlert({ type: "error", message: "ネットワークエラーが発生しました" });
    } finally {
      setLoading(null);
    }
  }

  async function handleStop() {
    setLoading("stop");
    setAlert(null);
    try {
      const res = await fetch("/api/capture/stop", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setAlert({ type: "success", message: data.message ?? "停止しました" });
        await fetchStatus();
      } else {
        setAlert({ type: "error", message: data.error ?? "停止に失敗しました" });
      }
    } catch {
      setAlert({ type: "error", message: "ネットワークエラーが発生しました" });
    } finally {
      setLoading(null);
    }
  }

  async function handleImport() {
    setLoading("import");
    setAlert(null);
    try {
      const res = await fetch("/api/capture/import", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setAlert({ type: "success", message: `インポート完了: ${data.file}` });
        await fetchStatus();
        onRefresh?.();
      } else {
        setAlert({ type: "error", message: data.error ?? "インポートに失敗しました" });
      }
    } catch {
      setAlert({ type: "error", message: "ネットワークエラーが発生しました" });
    } finally {
      setLoading(null);
    }
  }

  async function handleRefresh() {
    setLoading("refresh");
    setAlert(null);
    await fetchStatus();
    onRefresh?.();
    setLoading(null);
  }

  const isRunning = status?.running ?? false;
  const busy = loading !== null;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 md:p-4">
      {/* Header: title + status badge + collapse toggle */}
      <button
        className="w-full flex flex-wrap items-center gap-x-3 gap-y-1 text-left"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
      >
        <span className="text-sm font-semibold text-slate-300">キャプチャ管理</span>

        {/* Status badge */}
        {status === null ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
            確認中
          </span>
        ) : isRunning ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-green-700 bg-green-950 px-2.5 py-0.5 text-xs font-medium text-green-300">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            キャプチャ中
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
            停止中
          </span>
        )}

        {/* Meta timestamps — hidden on mobile to save space */}
        <div className="hidden sm:flex flex-wrap gap-3 text-xs text-slate-500 ml-auto">
          <span>
            最終開始:{" "}
            <span className="text-slate-400">{fmtDatetime(status?.lastStartedAt ?? null)}</span>
          </span>
          <span>
            最終インポート:{" "}
            <span className="text-slate-400">{fmtDatetime(status?.lastImportedAt ?? null)}</span>
          </span>
        </div>

        <span className="ml-auto sm:ml-0 text-slate-600 text-[10px]">{collapsed ? "▼" : "▲"}</span>
      </button>

      {/* Collapsible body */}
      {!collapsed && (
        <>
          {/* Button grid: 2×2 on mobile, row on desktop */}
          <div className="mt-3 grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            <button
              onClick={handleStart}
              disabled={isRunning || busy}
              className="inline-flex items-center justify-center gap-1.5 rounded border border-green-700 bg-green-950 px-3 py-2.5 text-sm font-medium text-green-300 hover:bg-green-900 active:bg-green-800 disabled:cursor-not-allowed disabled:opacity-40 transition-colors min-h-[44px]"
            >
              {loading === "start" ? (
                <Spinner className="border-green-500 border-t-green-200" />
              ) : (
                <span aria-hidden>▶</span>
              )}
              開始
            </button>

            <button
              onClick={handleStop}
              disabled={!isRunning || busy}
              className="inline-flex items-center justify-center gap-1.5 rounded border border-red-700 bg-red-950 px-3 py-2.5 text-sm font-medium text-red-300 hover:bg-red-900 active:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40 transition-colors min-h-[44px]"
            >
              {loading === "stop" ? (
                <Spinner className="border-red-500 border-t-red-200" />
              ) : (
                <span aria-hidden>■</span>
              )}
              停止
            </button>

            <button
              onClick={handleImport}
              disabled={busy}
              className="inline-flex items-center justify-center gap-1.5 rounded border border-blue-700 bg-blue-950 px-3 py-2.5 text-sm font-medium text-blue-300 hover:bg-blue-900 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40 transition-colors min-h-[44px]"
            >
              {loading === "import" ? (
                <Spinner className="border-blue-500 border-t-blue-200" />
              ) : (
                <span aria-hidden>↓</span>
              )}
              インポート
            </button>

            <button
              onClick={handleRefresh}
              disabled={busy}
              className="inline-flex items-center justify-center gap-1.5 rounded border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 active:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40 transition-colors min-h-[44px]"
            >
              {loading === "refresh" ? (
                <Spinner className="border-slate-500 border-t-slate-200" />
              ) : (
                <span aria-hidden>↻</span>
              )}
              状態更新
            </button>
          </div>

          {/* Meta timestamps on mobile (inside collapsed body) */}
          {status && (
            <div className="sm:hidden mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
              <span>
                最終開始:{" "}
                <span className="text-slate-400">{fmtDatetime(status.lastStartedAt)}</span>
              </span>
              <span>
                最終インポート:{" "}
                <span className="text-slate-400">{fmtDatetime(status.lastImportedAt)}</span>
              </span>
            </div>
          )}

          {/* Alert */}
          {alert && (
            <div
              className={`mt-3 flex items-start justify-between gap-2 rounded px-3 py-2.5 text-sm ${
                alert.type === "success"
                  ? "border border-green-800 bg-green-950/50 text-green-300"
                  : "border border-red-800 bg-red-950/50 text-red-300"
              }`}
              role="alert"
            >
              <span>
                {alert.type === "success" ? "✓ " : "✗ "}
                {alert.message}
              </span>
              <button
                onClick={() => setAlert(null)}
                aria-label="閉じる"
                className="shrink-0 text-lg leading-none opacity-60 hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Spinner({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-3 w-3 animate-spin rounded-full border ${className}`}
    />
  );
}

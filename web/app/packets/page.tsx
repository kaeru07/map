"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildAnalysis } from "@/lib/analysis";
import { ComprehensiveAnalysis, Packet, PacketFilters, PacketsResponse } from "@/lib/types";
import { StatsCards } from "@/components/StatsCards";
import { FilterBar } from "@/components/FilterBar";
import { PacketTable } from "@/components/PacketTable";
import { PacketDetail } from "@/components/PacketDetail";
import { CaptureControl } from "@/components/CaptureControl";
import { VpnStatusCard } from "@/components/VpnStatusCard";
import { CapturedInfo } from "@/components/CapturedInfo";
import { OperationAnalysis } from "@/components/OperationAnalysis";
import { SessionAnalysis } from "@/components/SessionAnalysis";

// フィルター済みパケットを最大 FETCH_LIMIT 件取得し、
// その結果から解析・一覧・コピーをすべて生成する。
const FETCH_LIMIT    = 2000; // 1回の fetch で取得する上限
const DISPLAY_SIZE   = 100;  // テーブル 1 ページあたりの件数

export default function PacketsPage() {
  // ── データ ─────────────────────────────────────────────────────────────────
  const [filters,     setFilters]     = useState<PacketFilters>({});
  const [allPackets,  setAllPackets]  = useState<Packet[]>([]);
  const [dbTotal,     setDbTotal]     = useState(0);   // DB 上の該当総件数
  const [analysis,    setAnalysis]    = useState<ComprehensiveAnalysis | null>(null);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [selected,    setSelected]    = useState<Packet | null>(null);
  const [refreshKey,  setRefreshKey]  = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [demoReason,  setDemoReason]  = useState<"no_db_config" | "db_error" | null>(null);
  const [demoError,   setDemoError]   = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // ── データ取得 ─────────────────────────────────────────────────────────────
  // 1. フィルター条件でパケットを最大 FETCH_LIMIT 件取得
  // 2. 取得したパケット全体から解析を計算
  // 3. 一覧・解析・取得結果・コピー は全てこの結果を共有する

  const fetchAll = useCallback(async (f: PacketFilters) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    setAllPackets([]);
    setAnalysis(null);

    try {
      const params = new URLSearchParams();
      params.set("page",     "1");
      params.set("pageSize", String(FETCH_LIMIT));
      if (f.protocol) params.set("protocol", f.protocol);
      if (f.srcIp)    params.set("srcIp",    f.srcIp);
      if (f.dstIp)    params.set("dstIp",    f.dstIp);
      if (f.dstPort)  params.set("dstPort",  f.dstPort);
      if (f.timeFrom) params.set("timeFrom", f.timeFrom);
      if (f.timeTo)   params.set("timeTo",   f.timeTo);
      if (f.search)   params.set("search",   f.search);

      const res = await fetch(`/api/packets?${params}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`サーバーエラー: ${res.status} ${res.statusText}`);

      const data: PacketsResponse = await res.json();
      setAllPackets(data.packets);
      setDbTotal(data.total);
      setDemoReason(data.demoReason ?? null);
      setDemoError(data.demoError ?? null);
      setLastUpdated(new Date());
      // フィルター済みパケットから解析を計算（唯一のデータソース）
      setAnalysis(buildAnalysis(data.packets, f));
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        setError(e.message || "データの取得に失敗しました");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // ── フィルター / refreshKey 変化時に再取得 ──────────────────────────────────
  useEffect(() => {
    setPage(1);
    setSelected(null);
    fetchAll(filters);
  }, [filters, fetchAll, refreshKey]);

  // ── クライアントサイドページネーション ──────────────────────────────────────
  const displayedPackets = allPackets.slice((page - 1) * DISPLAY_SIZE, page * DISPLAY_SIZE);
  const totalPages       = Math.max(1, Math.ceil(allPackets.length / DISPLAY_SIZE));

  // ── ヘルパー ────────────────────────────────────────────────────────────────
  function fmtTime(d: Date) {
    return d.toLocaleTimeString("ja-JP", {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  }

  // CapturedInfo / FilterBar からのフィルター変更（キーをマージ）
  function handleFilter(f: Partial<PacketFilters>) {
    setFilters((prev) => ({ ...prev, ...f }));
    setSelected(null);
  }

  function handleRefresh() {
    setRefreshKey((k) => k + 1);
  }

  // 解析を再計算して上書き（フィルターは変えない）
  function refreshAnalysis() {
    if (allPackets.length > 0) {
      setAnalysis(buildAnalysis(allPackets, filters));
    } else {
      fetchAll(filters);
    }
  }

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      {/* 比較モードへの導線。トップ(/)はグアム旅行アプリなので、NetScope の画面間移動はここに置く */}
      <div className="flex justify-end">
        <a
          href="/compare"
          className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100"
        >
          <span className="text-blue-400">⇄</span>
          比較モード
        </a>
      </div>

      {/* VPN ステータス */}
      <VpnStatusCard refreshKey={refreshKey} />

      {/* キャプチャ管理 */}
      <CaptureControl onRefresh={handleRefresh} />

      {/* 統計サマリー */}
      <StatsCards refreshKey={refreshKey} />

      {/* 操作推定 / 通信分析（フィルター連動） */}
      <OperationAnalysis analysis={analysis} loading={loading} />

      {/* セッション解析 Phase 5（フィルター連動） */}
      <SessionAnalysis analysis={analysis} loading={loading} />

      {/* 取得できた情報一覧（フィルター連動） */}
      <CapturedInfo
        analysis={analysis}
        loading={loading}
        onFilter={handleFilter}
        onRefresh={refreshAnalysis}
      />

      {/* フィルター + 更新ボタン */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <FilterBar
            filters={filters}
            onChange={(f) => { setFilters(f); setSelected(null); }}
          />
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="rounded border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors"
            title="最新データに更新"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <span className="animate-spin inline-block h-3 w-3 border border-slate-400 border-t-blue-400 rounded-full" />
                読込中
              </span>
            ) : (
              "↻ 更新"
            )}
          </button>
          {lastUpdated && (
            <span className="text-xs text-slate-600">
              最終更新: {fmtTime(lastUpdated)}
            </span>
          )}
        </div>
      </div>

      {/* DB 未接続バナー（原因別表示） */}
      {/* データベース未設定 */}
      {demoReason === "no_db_config" && (
        <div className="rounded-lg border border-yellow-700 bg-yellow-950/40 px-4 py-3 text-sm text-yellow-300 space-y-1">
          <div>
            <span className="font-semibold">⚠ データベース設定が未完了です</span>
            {" — "}サンプルデータを表示しています。
          </div>
          <div className="text-xs text-yellow-500">
            <code className="font-mono text-yellow-300">DIRECT_URL</code> または{" "}
            <code className="font-mono text-yellow-300">DATABASE_URL</code> を設定して{" "}
            <code className="font-mono text-yellow-300">pm2 restart netscope --update-env</code> を実行してください。
          </div>
          <div className="text-xs">
            <a href="/api/health" target="_blank" className="underline text-yellow-400 hover:text-yellow-200">
              /api/health で接続状況を確認
            </a>
          </div>
        </div>
      )}

      {/* DB接続失敗 */}
      {demoReason === "db_error" && (
        <div className="rounded-lg border border-red-700 bg-red-950/40 px-4 py-3 text-sm text-red-300 space-y-1">
          <div>
            <span className="font-semibold">⚠ データベースへ接続できませんでした</span>
            {" — "}サンプルデータを表示しています。
            <button onClick={handleRefresh} className="ml-3 underline hover:text-red-100">再試行</button>
          </div>
          {demoError && (
            <div className="text-xs font-mono text-red-400 bg-red-950 rounded px-2 py-1 break-all">
              {demoError.slice(0, 200)}
            </div>
          )}
          <div className="text-xs">
            <a href="/api/health" target="_blank" className="underline text-red-400 hover:text-red-200">
              /api/health で詳細を確認
            </a>
            <span className="ml-3 text-red-500">Supabase のネットワーク設定・認証情報を確認してください。</span>
          </div>
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          <span className="font-semibold">エラー: </span>{error}
          <button onClick={handleRefresh} className="ml-3 underline hover:text-red-100">
            再試行
          </button>
        </div>
      )}

      {/* 件数表示 */}
      {!error && (
        <div className="text-xs text-slate-500 h-4">
          {loading ? "" : allPackets.length === 0
            ? "データなし — capture.sh でキャプチャ後に import.sh で取り込んでください"
            : (
              <>
                {allPackets.length.toLocaleString()} 件表示
                {dbTotal > allPackets.length && (
                  <span className="text-yellow-600">
                    {" "}(DB 合計 {dbTotal.toLocaleString()} 件 — 上位 {FETCH_LIMIT.toLocaleString()} 件を取得済み)
                  </span>
                )}
                {totalPages > 1 && ` — ページ ${page} / ${totalPages}`}
              </>
            )
          }
        </div>
      )}

      {/* テーブル + 詳細パネル */}
      <div className="flex gap-3">
        <div
          className={`flex-1 min-w-0 rounded-lg border border-slate-700 bg-slate-900 overflow-hidden transition-all ${
            selected ? "hidden lg:block" : ""
          }`}
        >
          <PacketTable
            packets={displayedPackets}
            selectedId={selected?.id ?? null}
            onSelect={(p) => setSelected(p)}
            loading={loading}
          />
          {/* ページネーション */}
          {totalPages > 1 && !loading && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800 text-sm text-slate-400">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="disabled:opacity-40 hover:text-slate-100 transition-colors"
              >
                ← 前
              </button>
              <span>{page} / {totalPages}</span>
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

        {/* 詳細パネル */}
        {selected && (
          <div className="w-full lg:w-[420px] shrink-0 rounded-lg border border-slate-700 bg-slate-900 overflow-hidden">
            <PacketDetail packet={selected} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>
    </div>
  );
}

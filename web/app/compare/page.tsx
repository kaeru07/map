"use client";

import { useCallback, useState } from "react";
import { buildCompare, type CompareResult, type PortDiff, type Verdict } from "@/lib/compare";
import type { Packet, PacketsResponse } from "@/lib/types";

// ─── 定数 ────────────────────────────────────────────────────────────────────

const FETCH_LIMIT = 2000;

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

/** datetime-local value → ISO string */
function localToIso(local: string): string {
  if (!local) return "";
  return new Date(local).toISOString();
}

/** ISO → datetime-local value */
function isoToLocal(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 現在時刻から N 分前の datetime-local 文字列 */
function minutesAgo(n: number): string {
  return isoToLocal(new Date(Date.now() - n * 60_000).toISOString());
}

async function fetchPackets(from: string, to: string): Promise<Packet[]> {
  const params = new URLSearchParams({
    page:     "1",
    pageSize: String(FETCH_LIMIT),
    timeFrom: localToIso(from),
    timeTo:   localToIso(to),
  });
  const res = await fetch(`/api/packets?${params}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const data: PacketsResponse = await res.json();
  return data.packets;
}

// ─── スタイルヘルパー ─────────────────────────────────────────────────────────

function statusColor(status: PortDiff["status"]): string {
  switch (status) {
    case "blocked":   return "border-emerald-500 bg-emerald-950/40";
    case "reduced":   return "border-yellow-500  bg-yellow-950/40";
    case "increased": return "border-red-500     bg-red-950/40";
    case "new":       return "border-red-600     bg-red-950/50";
    case "stable":    return "border-slate-600   bg-slate-800/40";
    default:          return "border-slate-700   bg-slate-900/40";
  }
}

function statusBadge(status: PortDiff["status"]): string {
  switch (status) {
    case "blocked":   return "bg-emerald-900 text-emerald-300 border-emerald-600";
    case "reduced":   return "bg-yellow-900  text-yellow-300  border-yellow-600";
    case "increased": return "bg-red-900     text-red-300     border-red-600";
    case "new":       return "bg-red-900     text-red-300     border-red-600";
    case "stable":    return "bg-slate-800   text-slate-400   border-slate-600";
    default:          return "bg-slate-800   text-slate-500   border-slate-700";
  }
}

function statusLabel(status: PortDiff["status"]): string {
  switch (status) {
    case "blocked":   return "BLOCKED";
    case "reduced":   return "REDUCED";
    case "increased": return "INCREASED";
    case "new":       return "NEW";
    case "stable":    return "STABLE";
    default:          return "NONE";
  }
}

function verdictColor(level: Verdict["level"]): string {
  switch (level) {
    case "success": return "border-emerald-600 bg-emerald-950/30 text-emerald-300";
    case "warning": return "border-yellow-600  bg-yellow-950/30  text-yellow-300";
    case "danger":  return "border-red-600     bg-red-950/30     text-red-300";
    default:        return "border-slate-600   bg-slate-800/30   text-slate-400";
  }
}

function deltaText(delta: number): React.ReactNode {
  if (delta === 0) return <span className="text-slate-500">±0</span>;
  if (delta < 0)   return <span className="text-emerald-400">{delta}</span>;
  return <span className="text-red-400">+{delta}</span>;
}

function pctText(pct: number, status: PortDiff["status"]): React.ReactNode {
  if (status === "none") return null;
  if (status === "blocked") return <span className="text-emerald-400 font-bold">-100%</span>;
  if (pct === 0)  return <span className="text-slate-500">±0%</span>;
  if (pct < 0)    return <span className="text-emerald-400">{pct}%</span>;
  return <span className="text-red-400">+{pct}%</span>;
}

// ─── コンポーネント ───────────────────────────────────────────────────────────

function PortCard({ d }: { d: PortDiff }) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-3 ${statusColor(d.status)}`}>
      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-sm font-bold text-slate-100">{d.label}</span>
          {d.port !== null && (
            <span className="ml-2 text-xs text-slate-500 font-mono">:{d.port}</span>
          )}
          <p className="text-xs text-slate-500 mt-0.5">{d.desc}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusBadge(d.status)}`}>
          {statusLabel(d.status)}
        </span>
      </div>

      {/* 件数比較バー */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="w-12 text-slate-400 shrink-0">防御前</span>
          <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-red-500/70 rounded-full"
              style={{ width: d.before === 0 ? "0%" : "100%" }}
            />
          </div>
          <span className="w-10 text-right font-mono text-slate-300">{d.before}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-12 text-slate-400 shrink-0">防御後</span>
          <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-emerald-500/70 rounded-full"
              style={{
                width: d.before === 0
                  ? (d.after > 0 ? "100%" : "0%")
                  : `${Math.min(100, Math.round((d.after / d.before) * 100))}%`,
              }}
            />
          </div>
          <span className="w-10 text-right font-mono text-slate-300">{d.after}</span>
        </div>
      </div>

      {/* 差分表示 */}
      <div className="flex items-center justify-between text-xs border-t border-slate-700/50 pt-2">
        <span className="text-slate-500">差分</span>
        <div className="flex items-center gap-2 font-mono font-bold">
          {deltaText(d.delta)}
          <span className="text-slate-600">|</span>
          {pctText(d.pct, d.status)}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`mt-1 text-2xl font-mono font-bold ${accent ?? "text-slate-100"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── メインページ ─────────────────────────────────────────────────────────────

export default function ComparePage() {
  // 期間入力
  const [beforeFrom, setBeforeFrom] = useState(minutesAgo(60));
  const [beforeTo,   setBeforeTo]   = useState(minutesAgo(30));
  const [afterFrom,  setAfterFrom]  = useState(minutesAgo(30));
  const [afterTo,    setAfterTo]    = useState(minutesAgo(0));

  // 状態
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [result,   setResult]   = useState<CompareResult | null>(null);
  const [counts,   setCounts]   = useState<{ before: number; after: number } | null>(null);

  // クイック設定
  function setPreset(totalMinutes: number) {
    const half = Math.floor(totalMinutes / 2);
    setBeforeFrom(minutesAgo(totalMinutes));
    setBeforeTo(minutesAgo(half));
    setAfterFrom(minutesAgo(half));
    setAfterTo(minutesAgo(0));
  }

  const handleCompare = useCallback(async () => {
    if (!beforeFrom || !beforeTo || !afterFrom || !afterTo) {
      setError("すべての期間を入力してください");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const [beforePackets, afterPackets] = await Promise.all([
        fetchPackets(beforeFrom, beforeTo),
        fetchPackets(afterFrom,  afterTo),
      ]);
      setCounts({ before: beforePackets.length, after: afterPackets.length });
      setResult(buildCompare(
        beforePackets, afterPackets,
        { from: beforeFrom, to: beforeTo },
        { from: afterFrom,  to: afterTo  },
      ));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [beforeFrom, beforeTo, afterFrom, afterTo]);

  const totalDeltaAccent = result
    ? result.totalDelta < 0
      ? "text-emerald-400"
      : result.totalDelta > 0
        ? "text-red-400"
        : "text-slate-400"
    : undefined;

  return (
    <div className="flex flex-col gap-4 pb-10">
      {/* ページヘッダー */}
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
        <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <span className="text-blue-400">⇄</span>
          防御前後 比較モード
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          攻撃実行→防御実行 の前後で通信がどう変わったかを比較します。
          「防御前」「防御後」の期間を指定して比較ボタンを押してください。
        </p>
      </div>

      {/* 期間設定 */}
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            期間設定
          </h2>
          {/* クイックプリセット */}
          <div className="flex gap-2">
            <span className="text-xs text-slate-500 self-center">クイック:</span>
            {[
              { label: "直近1h", minutes: 60 },
              { label: "直近2h", minutes: 120 },
              { label: "直近30m", minutes: 30 },
            ].map(({ label, minutes }) => (
              <button
                key={minutes}
                onClick={() => setPreset(minutes)}
                className="text-xs px-2 py-1 rounded border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
              >
                {label}を前半/後半で比較
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 防御前 */}
          <div className="rounded-lg border border-red-900/60 bg-red-950/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              <span className="text-sm font-semibold text-red-300">防御前（攻撃中）</span>
              {counts && (
                <span className="ml-auto text-xs text-slate-500 font-mono">
                  {counts.before} 件取得
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500 block mb-1">開始</label>
                <input
                  type="datetime-local"
                  value={beforeFrom}
                  onChange={(e) => setBeforeFrom(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-slate-400"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">終了</label>
                <input
                  type="datetime-local"
                  value={beforeTo}
                  onChange={(e) => setBeforeTo(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-slate-400"
                />
              </div>
            </div>
          </div>

          {/* 防御後 */}
          <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-sm font-semibold text-emerald-300">防御後（遮断後）</span>
              {counts && (
                <span className="ml-auto text-xs text-slate-500 font-mono">
                  {counts.after} 件取得
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500 block mb-1">開始</label>
                <input
                  type="datetime-local"
                  value={afterFrom}
                  onChange={(e) => setAfterFrom(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-slate-400"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">終了</label>
                <input
                  type="datetime-local"
                  value={afterTo}
                  onChange={(e) => setAfterTo(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-slate-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 比較ボタン */}
        <button
          onClick={handleCompare}
          disabled={loading}
          className="w-full py-3 rounded-lg border border-blue-600 bg-blue-900/40 text-blue-300 font-semibold text-sm hover:bg-blue-900/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="animate-spin inline-block h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full" />
              比較中...
            </>
          ) : (
            <>⇄ 防御前後を比較する</>
          )}
        </button>

        {error && (
          <div className="rounded-lg border border-red-700 bg-red-950/40 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
      </div>

      {/* 比較結果 */}
      {result && (
        <>
          {/* サマリーカード */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard
              label="防御前 通信数"
              value={result.beforeCount.toLocaleString()}
              sub={`${result.beforePeriod.from.slice(11, 16)} ～ ${result.beforePeriod.to.slice(11, 16)}`}
              accent="text-red-300"
            />
            <SummaryCard
              label="防御後 通信数"
              value={result.afterCount.toLocaleString()}
              sub={`${result.afterPeriod.from.slice(11, 16)} ～ ${result.afterPeriod.to.slice(11, 16)}`}
              accent="text-emerald-300"
            />
            <SummaryCard
              label="総通信差分"
              value={(result.totalDelta > 0 ? "+" : "") + result.totalDelta.toLocaleString()}
              sub={result.totalDelta < 0 ? "通信が減少" : result.totalDelta > 0 ? "通信が増加" : "変化なし"}
              accent={totalDeltaAccent}
            />
            <SummaryCard
              label="遮断ポート数"
              value={result.ports.filter((p) => p.status === "blocked").length}
              sub={result.ports.filter((p) => p.status === "blocked").map((p) => p.label).join(" / ") || "なし"}
              accent="text-emerald-400"
            />
          </div>

          {/* 防御評価（Verdict） */}
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              防御評価
            </h2>
            <div className="space-y-2">
              {result.verdicts.map((v, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${verdictColor(v.level)}`}
                >
                  <span className="font-bold shrink-0 mt-0.5">{v.icon}</span>
                  <span>{v.message}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ポート別比較カード */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider px-1">
              ポート別比較
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {result.ports.map((pd, i) => (
                <PortCard key={i} d={pd} />
              ))}
            </div>
          </div>

          {/* プロトコル差分 + 攻撃元IP */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* プロトコル */}
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                プロトコル差分
              </h2>
              <div className="space-y-1">
                {result.protocols.length === 0 && (
                  <p className="text-xs text-slate-500">データなし</p>
                )}
                {result.protocols.map((pd, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800"
                  >
                    <span className="font-mono text-slate-300 w-16 shrink-0">{pd.protocol}</span>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-red-300 w-8 text-right">{pd.before}</span>
                      <span className="text-slate-600">→</span>
                      <span className="text-emerald-300 w-8 text-right">{pd.after}</span>
                      <span className="w-12 text-right">{deltaText(pd.delta)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusBadge(pd.status)}`}>
                        {statusLabel(pd.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 送信元IP */}
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                送信元IP 差分（上位10件）
              </h2>
              <div className="space-y-1">
                {result.topSrcIps.length === 0 && (
                  <p className="text-xs text-slate-500">データなし</p>
                )}
                {result.topSrcIps.map((ip, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800"
                  >
                    <span className="font-mono text-slate-400 truncate flex-1 mr-2">{ip.ip}</span>
                    <div className="flex items-center gap-2 font-mono shrink-0">
                      <span className="text-red-300">{ip.before}</span>
                      <span className="text-slate-600">→</span>
                      <span className="text-emerald-300">{ip.after}</span>
                      <span className="w-10 text-right">{deltaText(ip.delta)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 使い方ガイド */}
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4 text-xs text-slate-500 space-y-1">
            <p className="font-semibold text-slate-400">比較の使い方:</p>
            <ol className="list-decimal list-inside space-y-0.5 ml-1">
              <li>訓練コンパネ（:8888）で攻撃シナリオを実行</li>
              <li>訓練コンパネで防御操作（SSH遮断・HTTP遮断など）を実行</li>
              <li>このページで「防御前」= 攻撃中の期間、「防御後」= 遮断後の期間を指定</li>
              <li>「比較する」ボタンを押して差分を確認</li>
            </ol>
            <p className="mt-2 text-slate-600">
              取得上限: {FETCH_LIMIT.toLocaleString()} 件 / 期間 — 比較は取得済みパケットから計算されます
            </p>
          </div>
        </>
      )}
    </div>
  );
}

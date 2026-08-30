"use client";

import { useState } from "react";
import { PacketFilters } from "@/lib/types";

// ─── 期間フィルター ───────────────────────────────────────────────────────────

export type PeriodKey = "5m" | "15m" | "30m" | "1h" | "today" | "all";

const QUICK_PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "5m",    label: "直近5分" },
  { key: "15m",   label: "直近15分" },
  { key: "30m",   label: "直近30分" },
  { key: "1h",    label: "直近1時間" },
  { key: "today", label: "今日" },
  { key: "all",   label: "全期間" },
];

/** Date → datetime-local 値 (YYYY-MM-DDTHH:mm) */
function toLocalDT(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}`
  );
}

/** PeriodKey → { timeFrom, timeTo } を計算 (クリック時点の現在時刻ベース) */
function computePeriod(key: PeriodKey): Pick<PacketFilters, "timeFrom" | "timeTo"> {
  if (key === "all") return { timeFrom: undefined, timeTo: undefined };
  const now = new Date();
  let from: Date;
  switch (key) {
    case "5m":    from = new Date(now.getTime() -  5 * 60_000); break;
    case "15m":   from = new Date(now.getTime() - 15 * 60_000); break;
    case "30m":   from = new Date(now.getTime() - 30 * 60_000); break;
    case "1h":    from = new Date(now.getTime() - 60 * 60_000); break;
    default: {    // today
      from = new Date(now);
      from.setHours(0, 0, 0, 0);
    }
  }
  return { timeFrom: toLocalDT(from), timeTo: toLocalDT(now) };
}

// ─── プロトコルクイックフィルター ─────────────────────────────────────────────

type QuickFilter = {
  label: string;
  emoji: string;
  filter: Partial<PacketFilters>;
  color: string;
};

const QUICK_FILTERS: QuickFilter[] = [
  { label: "全件",    emoji: "◎",  filter: {},                      color: "slate" },
  { label: "VPN通信", emoji: "🔒", filter: { srcIp: "10.0.0." },    color: "purple" },
  { label: "iPhone",  emoji: "📱", filter: { srcIp: "10.0.0.2" },   color: "purple" },
  { label: "DNS",     emoji: "🌐", filter: { protocol: "DNS" },      color: "yellow" },
  { label: "TLS",     emoji: "🔐", filter: { protocol: "TLS" },      color: "violet" },
  { label: "HTTPS",   emoji: "🟠", filter: { protocol: "HTTPS" },    color: "orange" },
  { label: "HTTP",    emoji: "⬜", filter: { protocol: "HTTP" },     color: "orange" },
  { label: "UNKNOWN", emoji: "❓", filter: { protocol: "UNKNOWN" },  color: "slate" },
];

const PROTOCOLS = [
  "", "TCP", "UDP", "DNS", "TLS", "HTTP", "HTTPS", "ICMP", "ARP", "UNKNOWN",
];

const COLOR_MAP: Record<string, string> = {
  slate:  "border-slate-600  bg-slate-800   text-slate-300  data-[active=true]:bg-slate-600  data-[active=true]:text-white",
  purple: "border-purple-700 bg-purple-950  text-purple-300 data-[active=true]:bg-purple-700 data-[active=true]:text-white",
  yellow: "border-yellow-700 bg-yellow-950  text-yellow-300 data-[active=true]:bg-yellow-700 data-[active=true]:text-white",
  violet: "border-violet-700 bg-violet-950  text-violet-300 data-[active=true]:bg-violet-700 data-[active=true]:text-white",
  orange: "border-orange-700 bg-orange-950  text-orange-300 data-[active=true]:bg-orange-700 data-[active=true]:text-white",
};

// ─── アクティブバッジ ─────────────────────────────────────────────────────────

type Badge = { key: keyof PacketFilters; label: string; value: string };

function getActiveBadges(f: PacketFilters, period: PeriodKey | null): Badge[] {
  const result: Badge[] = [];
  if (period && period !== "all") {
    const pLabel = QUICK_PERIODS.find((p) => p.key === period)?.label ?? period;
    // 期間バッジは timeFrom/timeTo の代わりに1つだけ表示
    result.push({ key: "timeFrom", label: "期間", value: pLabel });
  } else {
    if (f.timeFrom) result.push({ key: "timeFrom", label: "開始",    value: f.timeFrom.replace("T", " ") });
    if (f.timeTo)   result.push({ key: "timeTo",   label: "終了",    value: f.timeTo.replace("T", " ")   });
  }
  if (f.search)   result.push({ key: "search",   label: "キーワード", value: f.search });
  if (f.protocol) result.push({ key: "protocol", label: "プロトコル", value: f.protocol });
  if (f.srcIp)    result.push({ key: "srcIp",    label: "送信元IP",   value: f.srcIp });
  if (f.dstIp)    result.push({ key: "dstIp",    label: "宛先IP",     value: f.dstIp });
  if (f.dstPort)  result.push({ key: "dstPort",  label: "宛先ポート", value: f.dstPort });
  return result;
}

// プロトコルクイックフィルターとの一致判定（時刻フィールドを除外）
function matchesQuick(f: PacketFilters, qf: QuickFilter): boolean {
  const { timeFrom: _1, timeTo: _2, ...rest } = f;
  const restKeys = Object.keys(rest) as (keyof typeof rest)[];
  const qfKeys = Object.keys(qf.filter) as (keyof PacketFilters)[];
  if (qfKeys.length === 0) return restKeys.length === 0;
  return (
    qfKeys.every((k) => f[k] === (qf.filter as PacketFilters)[k]) &&
    restKeys.length === qfKeys.length
  );
}

// ─── コンポーネント ───────────────────────────────────────────────────────────

type Props = {
  filters: PacketFilters;
  onChange: (f: PacketFilters) => void;
};

export function FilterBar({ filters, onChange }: Props) {
  const [open, setOpen]           = useState(true);
  const [activePeriod, setActivePeriod] = useState<PeriodKey | null>(null);

  const hasFilters = Object.keys(filters).length > 0;
  const badges     = getActiveBadges(filters, activePeriod);

  const inputClass =
    "w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelClass = "text-xs font-medium text-slate-400 mb-1";

  // ── 期間ボタン → timeFrom/timeTo だけ更新、他フィルターを維持 ──────────────
  function applyPeriod(key: PeriodKey) {
    const period = computePeriod(key);
    const next = { ...filters };
    if (period.timeFrom) next.timeFrom = period.timeFrom;
    else delete next.timeFrom;
    if (period.timeTo) next.timeTo = period.timeTo;
    else delete next.timeTo;
    setActivePeriod(key);
    onChange(next);
  }

  // ── プロトコルクイック → 時刻フィルターを維持しつつ protocol/IP を置換 ────
  function applyQuick(qf: QuickFilter) {
    const next: PacketFilters = {};
    // 時刻フィルターを保持
    if (filters.timeFrom) next.timeFrom = filters.timeFrom;
    if (filters.timeTo)   next.timeTo   = filters.timeTo;
    // プロトコル/IP フィルターを適用
    Object.assign(next, qf.filter);
    onChange(next);
  }

  function set(key: keyof PacketFilters, value: string) {
    onChange({ ...filters, [key]: value || undefined });
  }

  function removeFilter(key: keyof PacketFilters) {
    const next = { ...filters };
    // 期間バッジ削除 → timeFrom と timeTo を両方削除
    if (key === "timeFrom") {
      delete next.timeFrom;
      delete next.timeTo;
      setActivePeriod(null);
    } else {
      delete next[key];
    }
    onChange(next);
  }

  function clearAll() {
    onChange({});
    setActivePeriod(null);
  }

  // datetime-local 手動編集時は activePeriod をリセット
  function setTime(key: "timeFrom" | "timeTo", value: string) {
    setActivePeriod(null);
    onChange({ ...filters, [key]: value || undefined });
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden">

      {/* ── ヘッダー ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <span className="text-blue-400 text-sm">▼</span>
          <span className="text-sm font-semibold text-slate-200">通信を絞り込む</span>
          {hasFilters && (
            <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-xs font-bold text-white">
              {badges.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-1 rounded hover:bg-slate-700"
        >
          {open ? "▲ 閉じる" : "▼ 詳細フィルター"}
        </button>
      </div>

      {/* ── 期間フィルター ────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-slate-700/40">
        {/* クイック期間ボタン */}
        <div className="flex items-center gap-1.5 mb-2.5 overflow-x-auto pb-0.5">
          <span className="text-xs text-slate-500 shrink-0 mr-1">🕐 期間:</span>
          {QUICK_PERIODS.map((p) => {
            const isActive = activePeriod === p.key;
            return (
              <button
                key={p.key}
                onClick={() => applyPeriod(p.key)}
                className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors min-w-fit ${
                  isActive
                    ? "border-blue-500 bg-blue-600 text-white ring-1 ring-blue-400"
                    : "border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:border-slate-500"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* カスタム期間 (datetime-local) */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            value={filters.timeFrom ?? ""}
            onChange={(e) => setTime("timeFrom", e.target.value)}
            className="flex-1 min-w-[160px] rounded border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            title="開始日時"
          />
          <span className="text-slate-500 text-sm shrink-0">〜</span>
          <input
            type="datetime-local"
            value={filters.timeTo ?? ""}
            onChange={(e) => setTime("timeTo", e.target.value)}
            className="flex-1 min-w-[160px] rounded border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            title="終了日時"
          />
          {(filters.timeFrom || filters.timeTo) && (
            <button
              onClick={() => { setActivePeriod(null); removeFilter("timeFrom"); }}
              className="shrink-0 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-400 hover:text-red-300 hover:border-red-700 transition-colors"
              title="期間をクリア"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── プロトコルクイックフィルター ─────────────────────────────────── */}
      <div className="px-4 py-2.5 border-b border-slate-700/40 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          <span className="text-xs text-slate-500 shrink-0 mr-1">クイック:</span>
          {QUICK_FILTERS.map((qf) => {
            const active = matchesQuick(filters, qf);
            return (
              <button
                key={qf.label}
                onClick={() => applyQuick(qf)}
                data-active={active}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors hover:opacity-90 ${
                  COLOR_MAP[qf.color]
                } ${active ? "ring-1 ring-current" : ""}`}
              >
                <span aria-hidden>{qf.emoji}</span>
                {qf.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 適用中フィルターバッジ ─────────────────────────────────────── */}
      {badges.length > 0 && (
        <div className="px-4 py-2 border-b border-slate-700/40 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">適用中:</span>
          {badges.map((b) => (
            <span
              key={b.key}
              className="inline-flex items-center gap-1 rounded-full border border-blue-700 bg-blue-950 px-2.5 py-0.5 text-xs text-blue-200"
            >
              <span className="text-blue-400">{b.label}:</span>
              <span className="font-mono">{b.value}</span>
              <button
                onClick={() => removeFilter(b.key)}
                className="ml-0.5 text-blue-400 hover:text-white transition-colors"
                title={`${b.label} を解除`}
              >
                ×
              </button>
            </span>
          ))}
          <button
            onClick={clearAll}
            className="ml-1 text-xs text-slate-500 hover:text-red-400 transition-colors underline"
          >
            すべて解除
          </button>
        </div>
      )}

      {/* ── 詳細フィルター (折りたたみ) ──────────────────────────────────── */}
      {open && (
        <div className="px-4 py-3 flex flex-col gap-3">
          {/* キーワード検索 */}
          <div>
            <label className={labelClass}>
              🔍 キーワード検索
              <span className="ml-1 font-normal text-slate-500">（IP・ホスト名・SNI・DNS クエリ）</span>
            </label>
            <input
              type="text"
              placeholder="例: google.com　8.8.8.8　chatgpt.com"
              value={filters.search ?? ""}
              onChange={(e) => set("search", e.target.value)}
              className={inputClass}
            />
          </div>

          {/* プロトコル・宛先ポート・宛先IP */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>📡 プロトコル</label>
              <select
                value={filters.protocol ?? ""}
                onChange={(e) => set("protocol", e.target.value)}
                className={inputClass}
              >
                {PROTOCOLS.map((p) => (
                  <option key={p} value={p}>
                    {p || "すべてのプロトコル"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>
                🔢 宛先ポート
                <span className="ml-1 font-normal text-slate-500">（例: 443, 53）</span>
              </label>
              <input
                type="text"
                placeholder="443"
                value={filters.dstPort ?? ""}
                onChange={(e) => set("dstPort", e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className={labelClass}>🌍 宛先 IP アドレス</label>
              <input
                type="text"
                placeholder="例: 8.8.8.8"
                value={filters.dstIp ?? ""}
                onChange={(e) => set("dstIp", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* フィルター解除 */}
          {hasFilters && (
            <div className="flex justify-end pt-1">
              <button
                onClick={clearAll}
                className="inline-flex items-center gap-1.5 rounded border border-red-800 bg-red-950/60 px-4 py-2 text-sm text-red-300 hover:bg-red-900/60 transition-colors"
              >
                🗑 フィルターをすべて解除
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

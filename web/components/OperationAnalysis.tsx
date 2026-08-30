"use client";

import { useState } from "react";
import { fmtBytes } from "@/lib/analysis";
import { CATEGORY_COLOR, CATEGORY_LABEL } from "@/lib/categories";
import type {
  ActionEvent,
  BytesRanking,
  ComprehensiveAnalysis,
  Confidence,
  DnsCorrelation,
  OperationHint,
  ServiceSummary,
} from "@/lib/types";

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

function confidenceBadge(c: Confidence) {
  const styles: Record<Confidence, string> = {
    high:   "bg-green-900/50 text-green-300 border-green-700",
    medium: "bg-yellow-900/50 text-yellow-300 border-yellow-700",
    low:    "bg-slate-700/50 text-slate-400 border-slate-600",
  };
  const labels: Record<Confidence, string> = {
    high: "高", medium: "中", low: "低",
  };
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${styles[c]}`}>
      {labels[c]}
    </span>
  );
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return (
    String(d.getHours()).padStart(2, "0") + ":" +
    String(d.getMinutes()).padStart(2, "0")
  );
}

// ─── サブコンポーネント: タイムライン ─────────────────────────────────────────

function TimelineSection({ events }: { events: ActionEvent[] }) {
  const [expanded, setExpanded] = useState(false);
  const show = expanded ? events : events.slice(0, 10);

  if (events.length === 0) {
    return <p className="text-xs text-slate-500 italic">タイムラインデータなし</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {show.map((ev, i) => (
        <div
          key={i}
          className="flex items-start gap-2 rounded border border-slate-800 bg-slate-800/30 px-3 py-2"
        >
          <span className="shrink-0 font-mono text-xs text-slate-500 w-11">{ev.time}</span>
          <div className="flex-1 min-w-0">
            <span className="text-sm text-slate-200">{ev.action}</span>
            {ev.domain && (
              <span className="ml-2 truncate text-[11px] text-slate-500 font-mono">
                {ev.domain}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`hidden sm:inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] ${CATEGORY_COLOR[ev.category]}`}>
              {CATEGORY_LABEL[ev.category]}
            </span>
            {confidenceBadge(ev.confidence)}
          </div>
        </div>
      ))}
      {events.length > 10 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-blue-400 hover:text-blue-200 text-left mt-1"
        >
          {expanded ? "▲ 折りたたむ" : `▼ 残り ${events.length - 10} 件を表示`}
        </button>
      )}
    </div>
  );
}

// ─── サブコンポーネント: サービス別サマリー ────────────────────────────────────

function ServiceSummarySection({
  summaries,
  totalBytes,
}: {
  summaries: ServiceSummary[];
  totalBytes: number;
}) {
  if (summaries.length === 0) {
    return <p className="text-xs text-slate-500 italic">データなし</p>;
  }

  const maxCount = summaries[0]?.count ?? 1;

  return (
    <div className="flex flex-col gap-1.5">
      {summaries
        .filter((s) => s.category !== "Unknown" || s.count > 5)
        .map((s) => {
          const pct = Math.round((s.count / maxCount) * 100);
          return (
            <div key={s.category} className="flex items-center gap-2">
              <span
                className={`shrink-0 rounded border px-2 py-0.5 text-[11px] font-medium w-24 text-center ${CATEGORY_COLOR[s.category]}`}
              >
                {CATEGORY_LABEL[s.category]}
              </span>
              <div className="relative flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-blue-500/50"
                  style={{ width: `${Math.max(2, pct)}%` }}
                />
              </div>
              <span className="shrink-0 text-xs font-mono text-slate-400 w-14 text-right">
                {s.count.toLocaleString()}件
              </span>
              {s.bytes > 0 && (
                <span className="shrink-0 text-[11px] text-slate-600 w-16 text-right">
                  {fmtBytes(s.bytes)}
                </span>
              )}
            </div>
          );
        })}
      {totalBytes > 0 && (
        <p className="text-xs text-slate-600 mt-1">
          総通信量: {fmtBytes(totalBytes)}
        </p>
      )}
    </div>
  );
}

// ─── サブコンポーネント: 通信量ランキング ──────────────────────────────────────

function BytesRankingSection({ ranking }: { ranking: BytesRanking[] }) {
  if (ranking.length === 0) {
    return <p className="text-xs text-slate-500 italic">通信量データなし (bytes 未記録)</p>;
  }

  const maxBytes = ranking[0]?.bytes ?? 1;

  return (
    <div className="flex flex-col gap-1">
      {ranking.slice(0, 10).map((r, i) => {
        const pct = Math.round((r.bytes / maxBytes) * 100);
        return (
          <div key={r.domain} className="flex items-center gap-2">
            <span className="shrink-0 w-5 text-right text-[10px] text-slate-600 font-mono">
              {i + 1}
            </span>
            <span
              className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] w-20 text-center ${CATEGORY_COLOR[r.serviceCategory]}`}
            >
              {CATEGORY_LABEL[r.serviceCategory]}
            </span>
            <div className="relative flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden min-w-0">
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-orange-500/60"
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
            <span className="shrink-0 text-[11px] font-mono text-slate-300 truncate max-w-[120px] sm:max-w-none">
              {r.domain}
            </span>
            <span className="shrink-0 text-xs text-orange-400 font-mono">
              {fmtBytes(r.bytes)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── サブコンポーネント: DNS → 後続通信 ──────────────────────────────────────

function DnsCorrelationSection({ correlations }: { correlations: DnsCorrelation[] }) {
  const [expanded, setExpanded] = useState(false);
  const show = expanded ? correlations : correlations.slice(0, 6);

  if (correlations.length === 0) {
    return (
      <p className="text-xs text-slate-500 italic">
        DNS 後続通信の関連付けなし (DNS パケットが少ないか、後続通信が 30 秒以内に見つからなかった)
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {show.map((c, i) => (
        <div key={i} className="rounded border border-slate-800 bg-slate-800/20 overflow-hidden">
          {/* DNS クエリ行 */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-900/20 border-b border-slate-800">
            <span className="text-[10px] font-mono text-slate-500">{fmtTime(c.dnsTimestamp)}</span>
            <span className="text-xs font-medium text-yellow-300">DNS</span>
            <span className="flex-1 truncate text-xs font-mono text-yellow-200">{c.dnsQuery}</span>
            {c.dnsResponseIps.length > 0 && (
              <span className="text-[10px] text-slate-500 hidden sm:block">
                → {c.dnsResponseIps.slice(0, 2).join(", ")}
                {c.dnsResponseIps.length > 2 ? "..." : ""}
              </span>
            )}
          </div>
          {/* 後続通信 */}
          {c.followups.map((fu, j) => (
            <div
              key={j}
              className="flex items-center gap-2 px-3 py-1 border-b border-slate-800/50 last:border-0"
            >
              <span className="w-2 shrink-0 text-slate-700">↳</span>
              <span className="text-[10px] font-mono text-slate-600">{fmtTime(fu.timestamp)}</span>
              <span className="text-[11px] font-medium text-slate-400 w-12">{fu.protocol}</span>
              <span className="flex-1 truncate text-[11px] font-mono text-slate-300">
                {fu.domain ?? fu.dstIp}
              </span>
              {fu.bytes != null && fu.bytes > 0 && (
                <span className="shrink-0 text-[11px] text-orange-400">{fmtBytes(fu.bytes)}</span>
              )}
              <span className={`shrink-0 rounded border px-1 py-0.5 text-[9px] ${CATEGORY_COLOR[fu.serviceCategory]}`}>
                {CATEGORY_LABEL[fu.serviceCategory]}
              </span>
            </div>
          ))}
        </div>
      ))}
      {correlations.length > 6 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-blue-400 hover:text-blue-200 text-left mt-1"
        >
          {expanded ? "▲ 折りたたむ" : `▼ 残り ${correlations.length - 6} 件を表示`}
        </button>
      )}
    </div>
  );
}

// ─── サブコンポーネント: 推定操作一覧 ────────────────────────────────────────

function OperationListSection({ operations }: { operations: OperationHint[] }) {
  const [expanded, setExpanded] = useState(false);

  // 重複排除: 同アクション + 同ドメインを 1 件にまとめる
  const deduped: OperationHint[] = [];
  const seen = new Set<string>();
  for (const op of operations) {
    const key = `${op.likelyAction}|${op.representativeDomain}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(op);
    }
  }

  const show = expanded ? deduped : deduped.slice(0, 12);

  if (deduped.length === 0) {
    return <p className="text-xs text-slate-500 italic">推定操作なし</p>;
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {show.map((op, i) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded border border-slate-800 bg-slate-800/30 px-3 py-2"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-200 leading-snug">{op.likelyAction}</p>
              {op.representativeDomain && (
                <p className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                  {op.representativeDomain}
                </p>
              )}
              <p className="text-[10px] text-slate-600 mt-0.5">{op.evidence}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={`rounded border px-1.5 py-0.5 text-[10px] ${CATEGORY_COLOR[op.serviceCategory]}`}>
                {CATEGORY_LABEL[op.serviceCategory]}
              </span>
              {confidenceBadge(op.confidence)}
              <span className="text-[10px] text-slate-600 font-mono">{fmtTime(op.timestamp)}</span>
            </div>
          </div>
        ))}
      </div>
      {deduped.length > 12 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-blue-400 hover:text-blue-200 mt-2"
        >
          {expanded ? "▲ 折りたたむ" : `▼ 残り ${deduped.length - 12} 件を表示`}
        </button>
      )}
    </div>
  );
}

// ─── 折りたたみセクション ──────────────────────────────────────────────────────

function Section({
  title,
  badge,
  children,
  defaultOpen = false,
}: {
  title: string;
  badge?: string | number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-slate-800 first:border-t-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800/50 transition-colors text-left"
      >
        <span className="flex-1 font-medium">{title}</span>
        {badge != null && (
          <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] text-slate-400">
            {badge}
          </span>
        )}
        <span className="text-slate-600 text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ─── メインコンポーネント ─────────────────────────────────────────────────────

type Props = {
  analysis: ComprehensiveAnalysis | null;
  loading?: boolean;
};

export function OperationAnalysis({ analysis, loading }: Props) {
  const [open, setOpen] = useState(false);
  const enriched = analysis?.enriched;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 overflow-hidden">
      {/* ヘッダー */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
      >
        <span className="flex items-center gap-2 font-medium">
          <span className="text-indigo-400">🔎</span>
          操作推定 / 通信分析
          {enriched && (
            <span className="text-xs text-slate-500 font-normal">
              {enriched.operationTimeline.length} イベント
              {enriched.totalBytes > 0 && ` · ${fmtBytes(enriched.totalBytes)}`}
            </span>
          )}
          {loading && (
            <span className="animate-spin inline-block h-3 w-3 border border-slate-500 border-t-indigo-400 rounded-full" />
          )}
        </span>
        <span className="text-slate-500 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {/* パネル本体 */}
      {open && (
        <div className="border-t border-slate-800">
          {loading && !enriched && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-400">
              <span className="animate-spin inline-block h-3 w-3 border border-slate-500 border-t-indigo-400 rounded-full" />
              分析中...
            </div>
          )}
          {!loading && !enriched && (
            <div className="px-4 py-3 text-sm text-slate-500">データがありません</div>
          )}

          {enriched && (
            <>
              {/* ① 操作推定タイムライン */}
              <Section
                title="操作推定タイムライン"
                badge={enriched.operationTimeline.length}
                defaultOpen={enriched.operationTimeline.length > 0}
              >
                <p className="text-[11px] text-slate-600 mb-2">
                  各分のもっとも信頼度の高い操作を表示しています
                </p>
                <TimelineSection events={enriched.operationTimeline} />
              </Section>

              {/* ② サービス別サマリー */}
              <Section
                title="サービス別サマリー"
                badge={enriched.serviceSummary.filter(s => s.category !== "Unknown").length}
              >
                <ServiceSummarySection
                  summaries={enriched.serviceSummary}
                  totalBytes={enriched.totalBytes}
                />
              </Section>

              {/* ③ 通信量ランキング */}
              <Section
                title="通信量ランキング (bytes)"
                badge={enriched.bytesRanking.length > 0 ? `Top ${Math.min(10, enriched.bytesRanking.length)}` : undefined}
              >
                {enriched.totalBytes === 0 ? (
                  <p className="text-xs text-slate-500 italic">
                    bytes 情報が記録されていません。tshark の -e frame.len オプションが有効か確認してください。
                  </p>
                ) : (
                  <BytesRankingSection ranking={enriched.bytesRanking} />
                )}
              </Section>

              {/* ④ DNS → 後続通信 */}
              <Section
                title="DNS → 実通信の流れ"
                badge={enriched.dnsCorrelations.length}
              >
                <p className="text-[11px] text-slate-600 mb-2">
                  DNS 問い合わせから 30 秒以内に続いた通信を関連付けています
                </p>
                <DnsCorrelationSection correlations={enriched.dnsCorrelations} />
              </Section>

              {/* ⑤ 推定操作一覧 */}
              <Section
                title="推定操作一覧"
                badge={enriched.estimatedOperations.length}
              >
                <p className="text-[11px] text-slate-600 mb-2">
                  ドメイン・プロトコル・通信量のパターンから操作を推測しています
                </p>
                <OperationListSection operations={enriched.estimatedOperations} />
              </Section>
            </>
          )}
        </div>
      )}
    </div>
  );
}

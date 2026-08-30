"use client";

import { useState } from "react";
import { fmtBytes } from "@/lib/analysis";
import { CATEGORY_COLOR, CATEGORY_LABEL } from "@/lib/categories";
import type {
  ComprehensiveAnalysis,
  FlowView,
  QuicFlow,
  ServiceCategory,
  SessionTag,
  TcpSession,
  TlsSession,
} from "@/lib/types";

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

function fmtDuration(secs: number): string {
  if (secs < 1)    return `${(secs * 1000).toFixed(0)} ms`;
  if (secs < 60)   return `${secs.toFixed(1)} s`;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}m ${s}s`;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return (
    String(d.getHours()).padStart(2, "0") + ":" +
    String(d.getMinutes()).padStart(2, "0") + ":" +
    String(d.getSeconds()).padStart(2, "0")
  );
}

const TAG_STYLE: Record<SessionTag, string> = {
  suspicious:   "bg-red-900/60 text-red-300 border-red-700",
  longSession:  "bg-orange-900/60 text-orange-300 border-orange-700",
  manyPackets:  "bg-yellow-900/60 text-yellow-300 border-yellow-700",
  unusualPort:  "bg-purple-900/60 text-purple-300 border-purple-700",
};

const TAG_LABEL: Record<SessionTag, string> = {
  suspicious:  "不審",
  longSession: "長時間",
  manyPackets: "多数",
  unusualPort: "特殊ポート",
};

function TagBadge({ tag }: { tag: SessionTag }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${TAG_STYLE[tag]}`}>
      {TAG_LABEL[tag]}
    </span>
  );
}

function TagList({ tags }: { tags: SessionTag[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tags.map(t => <TagBadge key={t} tag={t} />)}
    </div>
  );
}

function CatBadge({ cat }: { cat: string }) {
  const color = CATEGORY_COLOR[cat as ServiceCategory] ?? "bg-slate-700/50 text-slate-300 border-slate-600";
  const label = CATEGORY_LABEL[cat as ServiceCategory] ?? cat;
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${color}`}>
      {label}
    </span>
  );
}

// ─── 折りたたみコンテナ ───────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 hover:bg-slate-800 transition-colors text-left"
      >
        <span className="font-medium text-slate-200 text-sm">{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{count} 件</span>
          <span className="text-slate-400 text-xs">{open ? "▲" : "▼"}</span>
        </div>
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

// ─── ① QUIC フロー ────────────────────────────────────────────────────────────

function QuicFlowSection({ flows }: { flows: QuicFlow[] }) {
  const [expanded, setExpanded] = useState(false);
  const show = expanded ? flows : flows.slice(0, 10);

  if (flows.length === 0) {
    return <p className="text-xs text-slate-500 italic">QUIC フローなし (UDP port 443 パケットが必要)</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {show.map((f, i) => (
        <div key={i} className="rounded border border-slate-700 bg-slate-800/30 p-3">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <CatBadge cat={f.serviceCategory} />
            <span className="text-slate-200 text-sm font-mono truncate max-w-[200px]">
              {f.representativeDomain ?? f.dstIp}
            </span>
            <span className="text-slate-500 text-xs ml-auto">
              :{f.dstPort ?? "?"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-x-4 text-xs text-slate-400">
            <span>{f.packetCount} pkts</span>
            <span>{fmtBytes(f.totalBytes)}</span>
            <span>{fmtDuration(f.durationSecs)}</span>
            <span className="col-span-3 text-slate-600 font-mono truncate mt-1">
              {f.quicFlowId.slice(0, 32)}
            </span>
          </div>
          <TagList tags={f.tags} />
        </div>
      ))}
      {flows.length > 10 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs text-blue-400 hover:text-blue-300 text-left mt-1"
        >
          {expanded ? "▲ 折りたたむ" : `▼ 残り ${flows.length - 10} 件を表示`}
        </button>
      )}
    </div>
  );
}

// ─── ② TLS セッションタイムライン ─────────────────────────────────────────────

function TlsTimelineSection({ sessions }: { sessions: TlsSession[] }) {
  const [expanded, setExpanded] = useState(false);
  const show = expanded ? sessions : sessions.slice(0, 15);

  if (sessions.length === 0) {
    return <p className="text-xs text-slate-500 italic">TLS セッションなし</p>;
  }

  // タイムラインの時間軸を計算
  const startMs = Math.min(...sessions.map(s => new Date(s.firstSeen).getTime()));
  const endMs   = Math.max(...sessions.map(s => new Date(s.lastSeen).getTime()));
  const rangeMs = endMs - startMs || 1;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs text-slate-500 mb-1">
        {fmtTime(new Date(startMs).toISOString())} → {fmtTime(new Date(endMs).toISOString())}
        <span className="ml-2">({sessions.length} セッション)</span>
      </div>

      {/* タイムラインバー */}
      <div className="relative bg-slate-900 rounded border border-slate-700 p-3 overflow-x-auto">
        <div className="relative" style={{ height: `${Math.min(show.length * 24, 360)}px`, minWidth: "300px" }}>
          {show.map((s, i) => {
            const left  = ((new Date(s.firstSeen).getTime() - startMs) / rangeMs) * 100;
            const width = Math.max(
              ((new Date(s.lastSeen).getTime() - new Date(s.firstSeen).getTime()) / rangeMs) * 100,
              0.5
            );
            const color = CATEGORY_COLOR[s.serviceCategory] ?? "bg-slate-700/50 text-slate-300 border-slate-600";
            // extract bg color for bar
            const barColor = color.includes("blue") ? "bg-blue-500/70"
              : color.includes("green") ? "bg-green-500/70"
              : color.includes("yellow") ? "bg-yellow-500/70"
              : color.includes("orange") ? "bg-orange-500/70"
              : color.includes("purple") ? "bg-purple-500/70"
              : color.includes("red") ? "bg-red-500/70"
              : "bg-slate-500/70";

            return (
              <div
                key={i}
                className="absolute flex items-center"
                style={{ top: `${i * 24}px`, left: `${left}%`, width: `${width}%`, height: "20px" }}
                title={`${s.sni ?? s.dstIp} | ${fmtTime(s.firstSeen)} - ${fmtTime(s.lastSeen)} | ${s.packetCount} pkts`}
              >
                <div className={`h-full w-full rounded-sm ${barColor} border border-white/10 flex items-center overflow-hidden px-1`}>
                  <span className="text-[9px] text-white truncate leading-none">
                    {s.sni ?? s.dstIp}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* セッション一覧 */}
      <div className="flex flex-col gap-1.5 mt-2">
        {show.map((s, i) => (
          <div key={i} className="rounded border border-slate-700 bg-slate-800/30 p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <CatBadge cat={s.serviceCategory} />
              <span className="text-slate-200 text-sm font-mono truncate max-w-[180px]">
                {s.sni ?? s.dstIp}
              </span>
              {s.tlsVersion && (
                <span className="text-purple-400 text-xs">{s.tlsVersion}</span>
              )}
              {s.hasClientHello && (
                <span className="text-green-500 text-[10px]">ClientHello</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-x-4 text-xs text-slate-400 mt-1.5">
              <span>{fmtTime(s.firstSeen)}</span>
              <span>{s.packetCount} pkts / {fmtBytes(s.totalBytes)}</span>
              <span>{fmtDuration((new Date(s.lastSeen).getTime() - new Date(s.firstSeen).getTime()) / 1000)}</span>
            </div>
            <TagList tags={s.tags} />
          </div>
        ))}
      </div>

      {sessions.length > 15 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs text-blue-400 hover:text-blue-300 text-left mt-1"
        >
          {expanded ? "▲ 折りたたむ" : `▼ 残り ${sessions.length - 15} 件を表示`}
        </button>
      )}
    </div>
  );
}

// ─── ③ TCP セッション ─────────────────────────────────────────────────────────

function TcpSessionSection({ sessions }: { sessions: TcpSession[] }) {
  const [expanded, setExpanded] = useState(false);
  const show = expanded ? sessions : sessions.slice(0, 10);

  if (sessions.length === 0) {
    return <p className="text-xs text-slate-500 italic">TCP セッションなし (flowId フィールドが必要)</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {show.map((s, i) => (
        <div key={i} className="rounded border border-slate-700 bg-slate-800/30 p-3">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <CatBadge cat={s.serviceCategory} />
            <span className="text-slate-200 text-sm font-mono truncate max-w-[180px]">
              {s.representativeDomain ?? s.dstIp}
            </span>
            <span className="text-slate-500 text-xs">:{s.dstPort ?? "?"}</span>
            <div className="ml-auto flex gap-1">
              {s.hasSyn  && <span className="text-blue-400 text-[10px] font-mono">SYN</span>}
              {s.hasFin  && <span className="text-green-400 text-[10px] font-mono">FIN</span>}
              {s.hasRst  && <span className="text-red-400 text-[10px] font-mono">RST</span>}
              {s.isComplete && <span className="text-green-500 text-[10px]">✓ 正常</span>}
              {s.isReset    && !s.isComplete && <span className="text-red-500 text-[10px]">✗ リセット</span>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-x-4 text-xs text-slate-400">
            <span>{fmtTime(s.firstSeen)}</span>
            <span>{s.packetCount} pkts / {fmtBytes(s.totalBytes)}</span>
            <span>{fmtDuration(s.durationSecs)}</span>
            <span className="col-span-3 text-slate-600 font-mono truncate mt-0.5">
              {s.flowId.slice(0, 24)}
            </span>
          </div>
          <TagList tags={s.tags} />
        </div>
      ))}
      {sessions.length > 10 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs text-blue-400 hover:text-blue-300 text-left mt-1"
        >
          {expanded ? "▲ 折りたたむ" : `▼ 残り ${sessions.length - 10} 件を表示`}
        </button>
      )}
    </div>
  );
}

// ─── ④ flowId ビュー ──────────────────────────────────────────────────────────

function FlowViewSection({ flows }: { flows: FlowView[] }) {
  const [expanded, setExpanded] = useState(false);
  const show = expanded ? flows : flows.slice(0, 10);

  if (flows.length === 0) {
    return <p className="text-xs text-slate-500 italic">フローなし (flowId フィールドが必要)</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-slate-300 border-collapse">
          <thead>
            <tr className="border-b border-slate-700 text-slate-500">
              <th className="text-left py-1.5 pr-3">ドメイン / IP</th>
              <th className="text-left py-1.5 pr-3">プロトコル</th>
              <th className="text-right py-1.5 pr-3">パケット</th>
              <th className="text-right py-1.5 pr-3">サイズ</th>
              <th className="text-right py-1.5 pr-3">時間</th>
              <th className="text-left py-1.5">タグ</th>
            </tr>
          </thead>
          <tbody>
            {show.map((f, i) => (
              <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/30">
                <td className="py-1.5 pr-3">
                  <div className="flex items-center gap-1.5">
                    <CatBadge cat={f.serviceCategory} />
                    <span className="font-mono truncate max-w-[150px]">
                      {f.representativeDomain ?? f.dstIp}
                    </span>
                    <span className="text-slate-600">:{f.dstPort ?? "?"}</span>
                  </div>
                </td>
                <td className="py-1.5 pr-3 font-mono text-blue-400">{f.protocol}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{f.packetCount}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{fmtBytes(f.totalBytes)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{fmtDuration(f.durationSecs)}</td>
                <td className="py-1.5">
                  <div className="flex flex-wrap gap-1">
                    {f.tags.map(t => <TagBadge key={t} tag={t} />)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {flows.length > 10 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs text-blue-400 hover:text-blue-300 text-left mt-1"
        >
          {expanded ? "▲ 折りたたむ" : `▼ 残り ${flows.length - 10} 件を表示`}
        </button>
      )}
    </div>
  );
}

// ─── メインコンポーネント ─────────────────────────────────────────────────────

type Props = {
  analysis: ComprehensiveAnalysis | null;
  loading: boolean;
};

export function SessionAnalysis({ analysis, loading }: Props) {
  if (loading) {
    return (
      <div className="text-center text-slate-500 py-8 text-sm">
        セッション解析中...
      </div>
    );
  }
  if (!analysis) return null;

  const enriched = analysis.enriched;
  if (!enriched) return null;

  const { quicFlows, tlsSessions, tcpSessions, flowViews } = enriched;

  const hasSessions =
    (quicFlows?.length ?? 0) > 0 ||
    (tlsSessions?.length ?? 0) > 0 ||
    (tcpSessions?.length ?? 0) > 0 ||
    (flowViews?.length ?? 0) > 0;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-slate-400 tracking-widest uppercase">
        セッション解析 (Phase 5)
      </h2>

      {!hasSessions && (
        <p className="text-xs text-slate-500 italic">
          セッション解析データなし。v4 フィールド (flowId, tcpSyn, quicFlowId 等) を含むパケットが必要です。
        </p>
      )}

      {(quicFlows?.length ?? 0) > 0 && (
        <CollapsibleSection
          title="① QUIC フロー"
          count={quicFlows?.length ?? 0}
          defaultOpen={true}
        >
          <QuicFlowSection flows={quicFlows ?? []} />
        </CollapsibleSection>
      )}

      {(tlsSessions?.length ?? 0) > 0 && (
        <CollapsibleSection
          title="② TLS セッションタイムライン"
          count={tlsSessions?.length ?? 0}
          defaultOpen={true}
        >
          <TlsTimelineSection sessions={tlsSessions ?? []} />
        </CollapsibleSection>
      )}

      {(tcpSessions?.length ?? 0) > 0 && (
        <CollapsibleSection
          title="③ TCP セッション"
          count={tcpSessions?.length ?? 0}
          defaultOpen={false}
        >
          <TcpSessionSection sessions={tcpSessions ?? []} />
        </CollapsibleSection>
      )}

      {(flowViews?.length ?? 0) > 0 && (
        <CollapsibleSection
          title="④ フロービュー (flowId)"
          count={flowViews?.length ?? 0}
          defaultOpen={false}
        >
          <FlowViewSection flows={flowViews ?? []} />
        </CollapsibleSection>
      )}
    </section>
  );
}

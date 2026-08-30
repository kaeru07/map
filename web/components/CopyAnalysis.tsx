"use client";

import { useRef, useState } from "react";
import { fmtBytes } from "@/lib/analysis";
import { CATEGORY_LABEL } from "@/lib/categories";
import { ComprehensiveAnalysis, PacketFilters, ServiceCategory } from "@/lib/types";

// ─── クリップボード ───────────────────────────────────────────────────────────

/**
 * iOS Safari を含む全ブラウザ対応のコピー関数。
 * navigator.clipboard.writeText → execCommand('copy') の順で試行する。
 */
async function copyToClipboard(text: string): Promise<boolean> {
  // 1) Modern Clipboard API（HTTPS / localhost のみ）
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 権限拒否 etc → fallback へ
    }
  }

  // 2) execCommand fallback（HTTP 環境 / 古いブラウザ）
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    // iOS Safari はオフスクリーンで select が効かないため visible に置く
    ta.style.cssText =
      "position:fixed;top:0;left:0;width:2em;height:2em;padding:0;border:none;outline:none;box-shadow:none;background:transparent;opacity:0;";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, ta.value.length); // iOS 向け
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// ─── フィルター条件の文字列化 ─────────────────────────────────────────────────

/** datetime-local 文字列 (YYYY-MM-DDTHH:mm) を見やすい日本語表示に変換 */
function fmtDT(s: string): string {
  // "2026-04-11T18:00" → "2026/04/11 18:00"
  return s.replace(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}).*/, "$1/$2/$3 $4:$5");
}

function filterLines(f: PacketFilters): string[] {
  const lines: string[] = [];
  if (f.timeFrom || f.timeTo) {
    const from = f.timeFrom ? fmtDT(f.timeFrom) : "—";
    const to   = f.timeTo   ? fmtDT(f.timeTo)   : "—";
    lines.push(`期間: ${from} 〜 ${to}`);
  }
  if (f.protocol) lines.push(`プロトコル: ${f.protocol}`);
  if (f.srcIp)    lines.push(`送信元IP: ${f.srcIp}`);
  if (f.dstIp)    lines.push(`宛先IP: ${f.dstIp}`);
  if (f.dstPort)  lines.push(`宛先ポート: ${f.dstPort}`);
  if (f.search)   lines.push(`キーワード: ${f.search}`);
  return lines;
}

/** 解析期間テキストブロック（テキスト形式用） */
function periodBlock(f: PacketFilters): string {
  if (!f.timeFrom && !f.timeTo) return "";
  const from = f.timeFrom ? fmtDT(f.timeFrom) : "—";
  const to   = f.timeTo   ? fmtDT(f.timeTo)   : "—";
  return `解析期間: ${from} 〜 ${to}`;
}

// ─── フォーマッター ───────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function formatText(d: ComprehensiveAnalysis): string {
  const f = d.filters ?? {};
  const fLines = filterLines(f);
  const pb = periodBlock(f);
  const e = d.enriched;
  const lines: string[] = [
    "# NetScope 解析結果",
    `生成日時: ${fmtDate(d.generatedAt)}`,
    ...(pb ? ["", pb] : []),
    "",
    "■ フィルター条件",
    ...(fLines.length > 0 ? fLines.map((l) => `  - ${l}`) : ["  なし (全件)"]),
    "",
    "■ 通信サマリー",
    `  総通信数: ${d.summary.total.toLocaleString()}`,
    `  ユニークIP: ${d.summary.uniqueIPs.toLocaleString()}`,
    `  ユニークドメイン: ${d.summary.uniqueDomains.toLocaleString()}`,
    ...(e ? [`  総通信量: ${fmtBytes(e.totalBytes)}`] : []),
    "",
    "■ よく通信したドメイン (Top 10)",
    ...(d.topDomains.length > 0
      ? d.topDomains.map((x, i) => `  ${i + 1}. ${x.domain} (${x.count}件)`)
      : ["  (データなし)"]),
    "",
    "■ プロトコル内訳",
    ...d.protocols.map((x) => `  ${x.protocol}: ${x.count}件`),
    "",
    "■ VPN通信",
    `  iPhone通信: ${d.vpn.iPhonePackets.toLocaleString()}件`,
    `  VPN通信: ${d.vpn.vpnPackets.toLocaleString()}件`,
  ];

  // ── 強化分析セクション ──────────────────────────────────────────────────
  if (e) {
    // サービスカテゴリ
    if (e.serviceSummary.length > 0) {
      lines.push("", "■ サービスカテゴリ別サマリー");
      for (const s of e.serviceSummary) {
        const label = CATEGORY_LABEL[s.category] ?? s.category;
        const bStr  = s.bytes > 0 ? ` / ${fmtBytes(s.bytes)}` : "";
        lines.push(`  ${label}: ${s.count.toLocaleString()}件${bStr}`);
      }
    }

    // 通信量ランキング
    if (e.bytesRanking.length > 0 && e.totalBytes > 0) {
      lines.push("", "■ 通信量ランキング (Top 10)");
      for (const r of e.bytesRanking.slice(0, 10)) {
        const cat = CATEGORY_LABEL[r.serviceCategory] ?? r.serviceCategory;
        lines.push(`  ${r.domain} [${cat}] ${fmtBytes(r.bytes)} (${r.count}件)`);
      }
    }

    // 操作推定タイムライン
    if (e.operationTimeline.length > 0) {
      lines.push("", "■ 操作推定タイムライン");
      for (const ev of e.operationTimeline) {
        const conf = ev.confidence === "high" ? "★" : ev.confidence === "medium" ? "◆" : "・";
        lines.push(`  ${ev.time} ${conf} ${ev.action}${ev.domain ? ` (${ev.domain})` : ""}`);
      }
    }

    // DNS → 実通信
    if (e.dnsCorrelations.length > 0) {
      lines.push("", "■ DNS → 実通信の流れ");
      for (const c of e.dnsCorrelations.slice(0, 20)) {
        lines.push(`  [DNS] ${c.dnsQuery}`);
        for (const fu of c.followups.slice(0, 3)) {
          const bStr = fu.bytes && fu.bytes > 0 ? ` ${fmtBytes(fu.bytes)}` : "";
          lines.push(`    → ${fu.protocol} ${fu.domain ?? fu.dstIp}${bStr}`);
        }
      }
    }

    // 推定操作一覧 (重複除外)
    if (e.estimatedOperations.length > 0) {
      lines.push("", "■ 推定操作一覧");
      const seen = new Set<string>();
      for (const op of e.estimatedOperations) {
        const key = `${op.likelyAction}|${op.representativeDomain}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const cat = CATEGORY_LABEL[op.serviceCategory] ?? op.serviceCategory;
        const conf = op.confidence === "high" ? "高" : op.confidence === "medium" ? "中" : "低";
        lines.push(
          `  [${conf}] ${op.likelyAction} — ${op.representativeDomain ?? "—"} (${cat})`
        );
      }
    }

    // QUIC フロー
    if (e.quicFlows && e.quicFlows.length > 0) {
      lines.push("", "■ QUIC フロー");
      for (const f of e.quicFlows.slice(0, 20)) {
        const cat = CATEGORY_LABEL[f.serviceCategory] ?? f.serviceCategory;
        lines.push(`  ${f.representativeDomain ?? f.dstIp}:${f.dstPort ?? "?"} [${cat}] ${f.packetCount}pkts / ${fmtBytes(f.totalBytes)}${f.tags.length > 0 ? ` [${f.tags.join(",")}]` : ""}`);
      }
    }

    // TLS セッション
    if (e.tlsSessions && e.tlsSessions.length > 0) {
      lines.push("", "■ TLS セッション");
      for (const s of e.tlsSessions.slice(0, 20)) {
        const cat = CATEGORY_LABEL[s.serviceCategory] ?? s.serviceCategory;
        const ver = s.tlsVersion ? ` (${s.tlsVersion})` : "";
        lines.push(`  ${s.sni ?? s.dstIp}${ver} [${cat}] ${s.packetCount}pkts${s.tags.length > 0 ? ` [${s.tags.join(",")}]` : ""}`);
      }
    }

    // TCP セッション (不審なもののみ抜粋)
    if (e.tcpSessions && e.tcpSessions.length > 0) {
      const flagged = e.tcpSessions.filter(s => s.tags.length > 0);
      if (flagged.length > 0) {
        lines.push("", "■ TCP セッション (タグあり)");
        for (const s of flagged.slice(0, 20)) {
          const cat = CATEGORY_LABEL[s.serviceCategory] ?? s.serviceCategory;
          const flags = [s.hasSyn && "SYN", s.hasFin && "FIN", s.hasRst && "RST"].filter(Boolean).join("+");
          lines.push(`  ${s.representativeDomain ?? s.dstIp}:${s.dstPort ?? "?"} [${cat}] ${flags} ${s.packetCount}pkts [${s.tags.join(",")}]`);
        }
      }
    }
  }

  lines.push(
    "",
    "■ 最近の通信",
    ...(d.recentDomains.length > 0
      ? d.recentDomains.map((x) => `  - ${x}`)
      : ["  (データなし)"]),
    "",
    "■ SNI 一覧",
    ...(d.items.snIs.slice(0, 50).map((x, i) => `  ${i + 1}. ${x.value} (${x.count}件)`)),
    "",
    "■ DNS クエリ 一覧",
    ...(d.items.dnsQueries.slice(0, 50).map((x, i) => `  ${i + 1}. ${x.value} (${x.count}件)`)),
    "",
    "■ 宛先IP 一覧",
    ...(d.items.dstIPs.slice(0, 50).map((x, i) => `  ${i + 1}. ${x.value} (${x.count}件)`)),
    "",
    "■ 宛先ポート 一覧",
    ...(d.items.dstPorts.slice(0, 30).map((x, i) => `  ${i + 1}. ${x.value} (${x.count}件)`)),
  );
  return lines.join("\n");
}

function formatMarkdown(d: ComprehensiveAnalysis): string {
  const f = d.filters ?? {};
  const fLines = filterLines(f);
  const pb = periodBlock(f);
  const e = d.enriched;
  const lines: string[] = [
    "# NetScope 解析結果",
    "",
    `> 生成日時: ${fmtDate(d.generatedAt)}`,
    ...(pb ? ["", `> ${pb}`] : []),
    "",
    "## フィルター条件",
    "",
    ...(fLines.length > 0 ? fLines.map((l) => `- ${l}`) : ["なし (全件)"]),
    "",
    "## 通信サマリー",
    "",
    "| 項目 | 値 |",
    "|------|-----|",
    `| 総通信数 | ${d.summary.total.toLocaleString()} |`,
    `| ユニークIP | ${d.summary.uniqueIPs.toLocaleString()} |`,
    `| ユニークドメイン | ${d.summary.uniqueDomains.toLocaleString()} |`,
    ...(e ? [`| 総通信量 | ${fmtBytes(e.totalBytes)} |`] : []),
    "",
    "## よく通信したドメイン (Top 10)",
    "",
    ...(d.topDomains.length > 0
      ? d.topDomains.map((x, i) => `${i + 1}. **${x.domain}** (${x.count}件)`)
      : ["*(データなし)*"]),
    "",
    "## プロトコル内訳",
    "",
    ...d.protocols.map((x) => `- **${x.protocol}**: ${x.count}件`),
    "",
    "## VPN通信",
    "",
    `- iPhone通信: ${d.vpn.iPhonePackets.toLocaleString()}件`,
    `- VPN通信: ${d.vpn.vpnPackets.toLocaleString()}件`,
  ];

  // ── 強化分析セクション ──────────────────────────────────────────────────
  if (e) {
    // サービスカテゴリ
    if (e.serviceSummary.length > 0) {
      lines.push("", "## サービスカテゴリ別サマリー", "", "| サービス | 件数 | 通信量 |", "|---------|------|--------|");
      for (const s of e.serviceSummary) {
        const label = CATEGORY_LABEL[s.category] ?? s.category;
        lines.push(`| ${label} | ${s.count.toLocaleString()} | ${s.bytes > 0 ? fmtBytes(s.bytes) : "—"} |`);
      }
    }

    // 通信量ランキング
    if (e.bytesRanking.length > 0 && e.totalBytes > 0) {
      lines.push("", "## 通信量ランキング (Top 10)", "", "| # | ドメイン | サービス | 通信量 | 件数 |", "|---|---------|---------|--------|------|");
      e.bytesRanking.slice(0, 10).forEach((r, i) => {
        const cat = CATEGORY_LABEL[r.serviceCategory] ?? r.serviceCategory;
        lines.push(`| ${i + 1} | \`${r.domain}\` | ${cat} | ${fmtBytes(r.bytes)} | ${r.count} |`);
      });
    }

    // 操作推定タイムライン
    if (e.operationTimeline.length > 0) {
      lines.push("", "## 操作推定タイムライン", "");
      for (const ev of e.operationTimeline) {
        const conf = ev.confidence === "high" ? "**高**" : ev.confidence === "medium" ? "中" : "低";
        lines.push(`- **${ev.time}** ${ev.action}${ev.domain ? ` — \`${ev.domain}\`` : ""} (信頼度: ${conf})`);
      }
    }

    // DNS → 実通信
    if (e.dnsCorrelations.length > 0) {
      lines.push("", "## DNS → 実通信の流れ", "");
      for (const c of e.dnsCorrelations.slice(0, 20)) {
        lines.push(`- **[DNS]** \`${c.dnsQuery}\``);
        for (const fu of c.followups.slice(0, 3)) {
          const bStr = fu.bytes && fu.bytes > 0 ? ` ${fmtBytes(fu.bytes)}` : "";
          lines.push(`  - → ${fu.protocol} \`${fu.domain ?? fu.dstIp}\`${bStr}`);
        }
      }
    }

    // 推定操作一覧
    if (e.estimatedOperations.length > 0) {
      lines.push("", "## 推定操作一覧", "", "| 操作 | ドメイン | サービス | 信頼度 | 時刻 |", "|-----|---------|---------|--------|------|");
      const seen = new Set<string>();
      for (const op of e.estimatedOperations) {
        const key = `${op.likelyAction}|${op.representativeDomain}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const cat  = CATEGORY_LABEL[op.serviceCategory] ?? op.serviceCategory;
        const conf = op.confidence === "high" ? "高" : op.confidence === "medium" ? "中" : "低";
        const d2   = new Date(op.timestamp);
        const tm   = `${String(d2.getHours()).padStart(2,"0")}:${String(d2.getMinutes()).padStart(2,"0")}`;
        lines.push(`| ${op.likelyAction} | \`${op.representativeDomain ?? "—"}\` | ${cat} | ${conf} | ${tm} |`);
      }
    }

    // QUIC フロー
    if (e.quicFlows && e.quicFlows.length > 0) {
      lines.push("", "## QUIC フロー", "", "| ドメイン / IP | ポート | サービス | パケット | 通信量 | タグ |", "|-------------|-------|---------|--------|--------|------|");
      for (const f of e.quicFlows.slice(0, 20)) {
        const cat = CATEGORY_LABEL[f.serviceCategory] ?? f.serviceCategory;
        lines.push(`| \`${f.representativeDomain ?? f.dstIp}\` | ${f.dstPort ?? "?"} | ${cat} | ${f.packetCount} | ${fmtBytes(f.totalBytes)} | ${f.tags.join(", ") || "—"} |`);
      }
    }

    // TLS セッション
    if (e.tlsSessions && e.tlsSessions.length > 0) {
      lines.push("", "## TLS セッション", "", "| SNI / IP | バージョン | サービス | パケット | タグ |", "|---------|----------|---------|--------|------|");
      for (const s of e.tlsSessions.slice(0, 20)) {
        const cat = CATEGORY_LABEL[s.serviceCategory] ?? s.serviceCategory;
        lines.push(`| \`${s.sni ?? s.dstIp}\` | ${s.tlsVersion ?? "—"} | ${cat} | ${s.packetCount} | ${s.tags.join(", ") || "—"} |`);
      }
    }

    // TCP セッション (タグあり)
    if (e.tcpSessions && e.tcpSessions.length > 0) {
      const flagged = e.tcpSessions.filter(s => s.tags.length > 0);
      if (flagged.length > 0) {
        lines.push("", "## TCP セッション (タグあり)", "", "| ドメイン / IP | ポート | フラグ | パケット | タグ |", "|-------------|-------|-------|--------|------|");
        for (const s of flagged.slice(0, 20)) {
          const cat = CATEGORY_LABEL[s.serviceCategory] ?? s.serviceCategory;
          const flags = [s.hasSyn && "SYN", s.hasFin && "FIN", s.hasRst && "RST"].filter(Boolean).join("+");
          lines.push(`| \`${s.representativeDomain ?? s.dstIp}\` | ${s.dstPort ?? "?"} | ${flags} | ${s.packetCount} | ${s.tags.join(", ")} |`);
        }
      }
    }
  }

  lines.push(
    "",
    "## 最近の通信",
    "",
    ...(d.recentDomains.length > 0
      ? d.recentDomains.map((x) => `- \`${x}\``)
      : ["*(データなし)*"]),
    "",
    "## SNI 一覧",
    "",
    ...d.items.snIs.slice(0, 50).map((x, i) => `${i + 1}. \`${x.value}\` — ${x.count}件`),
    "",
    "## DNS クエリ 一覧",
    "",
    ...d.items.dnsQueries.slice(0, 50).map((x, i) => `${i + 1}. \`${x.value}\` — ${x.count}件`),
    "",
    "## 宛先IP 一覧",
    "",
    ...d.items.dstIPs.slice(0, 50).map((x, i) => `${i + 1}. \`${x.value}\` — ${x.count}件`),
    "",
    "## 宛先ポート 一覧",
    "",
    ...d.items.dstPorts.slice(0, 30).map((x, i) => `${i + 1}. \`${x.value}\` — ${x.count}件`),
    "",
    "---",
    "*Generated by NetScope*",
  );
  return lines.join("\n");
}

function formatJson(d: ComprehensiveAnalysis): string {
  return JSON.stringify(d, null, 2);
}

// ─── 定数 ─────────────────────────────────────────────────────────────────────

type FormatKey = "text" | "markdown" | "json";

const FORMATS: { key: FormatKey; label: string; fn: (d: ComprehensiveAnalysis) => string }[] = [
  { key: "text",     label: "テキスト", fn: formatText },
  { key: "markdown", label: "Markdown", fn: formatMarkdown },
  { key: "json",     label: "JSON",     fn: formatJson },
];

// ─── コンポーネント ───────────────────────────────────────────────────────────

type Props = {
  analysis: ComprehensiveAnalysis | null;
  loading?: boolean;
  onRefresh?: () => void;
};

export function CopyAnalysis({ analysis, loading, onRefresh }: Props) {
  const [open,       setOpen]       = useState(false);
  const [format,     setFormat]     = useState<FormatKey>("text");
  const [copyState,  setCopyState]  = useState<"idle" | "ok" | "fail">("idle");
  const textareaRef                 = useRef<HTMLTextAreaElement>(null);

  const currentFmt  = FORMATS.find((f) => f.key === format)!;
  const currentText = analysis ? currentFmt.fn(analysis) : "";

  // コピー処理 ─ ユーザー操作から直接呼ぶこと (iOS Safari の要件)
  async function handleCopy() {
    if (!currentText) return;
    const ok = await copyToClipboard(currentText);
    setCopyState(ok ? "ok" : "fail");
    setTimeout(() => setCopyState("idle"), 2500);
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 overflow-hidden">
      {/* ── ヘッダー (トグル) ───────────────────────────────────────────────── */}
      <button
        onClick={() => { setOpen((v) => !v); setCopyState("idle"); }}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
      >
        <span className="flex items-center gap-2 font-medium">
          <span className="text-blue-400">📋</span>
          解析結果をコピー
          {analysis && (
            <span className="text-xs text-slate-500 font-normal">
              {analysis.summary.total.toLocaleString()}件
              {Object.keys(analysis.filters ?? {}).length > 0 && " — フィルター適用中"}
            </span>
          )}
          {loading && (
            <span className="animate-spin inline-block h-3 w-3 border border-slate-500 border-t-blue-400 rounded-full" />
          )}
        </span>
        <span className="text-slate-500 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {/* ── パネル本体 ──────────────────────────────────────────────────────── */}
      {open && (
        <div className="border-t border-slate-800 px-4 py-3 flex flex-col gap-3">

          {/* ローディング */}
          {loading && !analysis && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="animate-spin inline-block h-3 w-3 border border-slate-500 border-t-blue-400 rounded-full" />
              読み込み中...
            </div>
          )}

          {/* データなし */}
          {!loading && !analysis && (
            <p className="text-sm text-slate-500">データを読み込んでいます...</p>
          )}

          {analysis && (
            <>
              {/* フォーマット選択 + コピーボタン + 更新 */}
              <div className="flex flex-wrap items-center gap-2">
                {/* フォーマットタブ */}
                <div className="flex rounded border border-slate-700 overflow-hidden">
                  {FORMATS.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setFormat(f.key)}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                        format === f.key
                          ? "bg-blue-600 text-white"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* コピーボタン */}
                <button
                  onClick={handleCopy}
                  className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
                    copyState === "ok"
                      ? "border-green-600 bg-green-950 text-green-300"
                      : copyState === "fail"
                      ? "border-red-600 bg-red-950 text-red-300"
                      : "border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 active:bg-slate-600"
                  }`}
                >
                  {copyState === "ok"   ? "✓ コピー完了!"
                  : copyState === "fail" ? "✗ コピー失敗"
                  : "⧉ コピー"}
                </button>

                {/* 更新ボタン */}
                {onRefresh && (
                  <button
                    onClick={onRefresh}
                    disabled={loading}
                    className="ml-auto inline-flex items-center gap-1 rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800 disabled:opacity-50 transition-colors"
                    title="解析データを再取得"
                  >
                    ↻ 更新
                  </button>
                )}
              </div>

              {/* 現在のフィルター条件 */}
              {filterLines(analysis.filters ?? {}).length > 0 && (
                <div className="rounded border border-slate-800 bg-slate-800/50 px-3 py-2 text-xs text-slate-400">
                  <span className="text-slate-500 mr-2">フィルター:</span>
                  {filterLines(analysis.filters ?? {}).join(" / ")}
                </div>
              )}

              {/* テキストエリア（読み取り専用・クリックで全選択） */}
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  readOnly
                  value={currentText}
                  rows={Math.min(24, currentText.split("\n").length + 1)}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-slate-300 font-mono resize-y focus:outline-none focus:border-blue-500"
                  onClick={(e) => {
                    const ta = e.target as HTMLTextAreaElement;
                    ta.focus();
                    ta.select();
                    ta.setSelectionRange(0, ta.value.length);
                  }}
                />
                <button
                  onClick={handleCopy}
                  className={`absolute top-2 right-2 rounded px-2 py-0.5 text-xs transition-colors ${
                    copyState === "ok"
                      ? "bg-green-800 text-green-200"
                      : copyState === "fail"
                      ? "bg-red-800 text-red-200"
                      : "bg-slate-700 text-slate-400 hover:bg-slate-600 active:bg-slate-500"
                  }`}
                >
                  {copyState === "ok" ? "✓" : copyState === "fail" ? "✗" : "コピー"}
                </button>
              </div>

              {/* コピー失敗時のガイド */}
              {copyState === "fail" && (
                <p className="text-xs text-red-400">
                  自動コピーに失敗しました。上のテキストエリアを全選択 → 手動でコピーしてください。
                </p>
              )}

              {/* 生成日時 */}
              <div className="text-xs text-slate-600">
                生成: {fmtDate(analysis.generatedAt)}
                {analysis.demo && <span className="ml-2 text-yellow-600">(デモデータ)</span>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

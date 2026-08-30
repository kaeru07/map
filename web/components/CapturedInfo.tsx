"use client";

import { useRef, useState } from "react";
import { CATEGORY_COLOR, CATEGORY_LABEL } from "@/lib/categories";
import { ComprehensiveAnalysis, InfoItem, PacketFilters, ServiceCategory } from "@/lib/types";

// ─── タブ定義 ─────────────────────────────────────────────────────────────────

type TabKey =
  | "all"
  | "domains"
  | "snIs"
  | "dnsQueries"
  | "dstIPs"
  | "protocols"
  | "dstPorts"
  | "serviceCategories"
  | "representativeDomains";

type TabDef = {
  key: TabKey;
  label: string;
  emoji: string;
  filterKey?: keyof PacketFilters;
  description: string;
};

const TABS: TabDef[] = [
  { key: "all",                  label: "全情報",         emoji: "📊", description: "すべてのカテゴリを一括表示・一括コピー" },
  { key: "serviceCategories",    label: "サービス",        emoji: "🏷", description: "サービスカテゴリ別の通信件数" },
  { key: "representativeDomains",label: "代表ドメイン",   emoji: "🌍", filterKey: "search",   description: "通信ごとの代表ドメイン (SNI > DNS > ホスト名)" },
  { key: "domains",              label: "ホスト名",        emoji: "🌐", filterKey: "search",   description: "TLS SNI・DNS・ホスト名をまとめたドメイン一覧" },
  { key: "snIs",                 label: "SNI",             emoji: "🔐", filterKey: "search",   description: "TLS 接続時のサーバー名 (SNI)" },
  { key: "dnsQueries",           label: "DNS",             emoji: "📡", filterKey: "search",   description: "DNS で問い合わせたドメイン名" },
  { key: "dstIPs",               label: "宛先IP",          emoji: "🖥", filterKey: "dstIp",   description: "通信先の IP アドレス一覧" },
  { key: "protocols",            label: "プロトコル",      emoji: "📶", filterKey: "protocol", description: "検出された通信プロトコル" },
  { key: "dstPorts",             label: "ポート",          emoji: "🔢", filterKey: "dstPort",  description: "通信先のポート番号 (443=HTTPS, 53=DNS など)" },
];

const PORT_LABELS: Record<string, string> = {
  "443": "HTTPS", "80": "HTTP", "53": "DNS", "22": "SSH",
  "25": "SMTP", "587": "SMTP", "993": "IMAPS", "465": "SMTPS",
  "8080": "HTTP Alt", "51820": "WireGuard",
};

// ─── クリップボード ───────────────────────────────────────────────────────────

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* fallthrough */ }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText =
      "position:fixed;top:0;left:0;width:2em;height:2em;padding:0;border:none;outline:none;background:transparent;opacity:0;";
    document.body.appendChild(ta);
    ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

// ─── 一括コピー用フォーマッター ───────────────────────────────────────────────

function fmtDT(s: string): string {
  return s.replace(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}).*/, "$1/$2/$3 $4:$5");
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
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

function section(title: string, items: InfoItem[], top = 50): string {
  if (!items.length) return `\n■ ${title}\n  (データなし)`;
  return [
    "",
    `■ ${title} (${items.length}種類)`,
    ...items.slice(0, top).map((x, i) => `  ${i + 1}. ${x.value} (${x.count}件)`),
    ...(items.length > top ? [`  ... 他 ${items.length - top} 種類`] : []),
  ].join("\n");
}

function sectionMd(title: string, items: InfoItem[], top = 50): string {
  if (!items.length) return `\n## ${title}\n\n*(データなし)*`;
  return [
    "",
    `## ${title} (${items.length}種類)`,
    "",
    ...items.slice(0, top).map((x, i) => `${i + 1}. \`${x.value}\` — ${x.count}件`),
    ...(items.length > top ? [`*(他 ${items.length - top} 種類)*`] : []),
  ].join("\n");
}

function bulkText(a: ComprehensiveAnalysis): string {
  const f  = a.filters ?? {};
  const fl = filterLines(f);
  const e  = a.enriched;
  const lines: string[] = [
    "# NetScope 取得結果",
    `生成日時: ${fmtDate(a.generatedAt)}`,
    "",
    "■ フィルター条件",
    ...(fl.length > 0 ? fl.map((l) => `  - ${l}`) : ["  なし (全件)"]),
    "",
    "■ 通信サマリー",
    `  総通信数: ${a.summary.total.toLocaleString()}`,
    `  ユニークIP: ${a.summary.uniqueIPs.toLocaleString()}`,
    `  ユニークドメイン: ${a.summary.uniqueDomains.toLocaleString()}`,
    "",
    "■ プロトコル内訳",
    ...a.protocols.map((x) => `  ${x.protocol}: ${x.count}件`),
    "",
    "■ VPN通信",
    `  VPN通信: ${a.vpn.vpnPackets.toLocaleString()}件`,
    `  iPhone通信: ${a.vpn.iPhonePackets.toLocaleString()}件`,
  ];
  if (e) {
    lines.push("", "■ サービスカテゴリ");
    for (const s of e.serviceSummary) {
      const label = CATEGORY_LABEL[s.category] ?? s.category;
      lines.push(`  ${label}: ${s.count.toLocaleString()}件`);
    }
    if (e.operationTimeline.length > 0) {
      lines.push("", "■ 操作推定タイムライン");
      for (const ev of e.operationTimeline) {
        lines.push(`  ${ev.time} ${ev.action}${ev.domain ? ` (${ev.domain})` : ""}`);
      }
    }
  }
  lines.push(
    section("代表ドメイン一覧",  a.items.representativeDomains),
    section("ドメイン一覧",       a.items.domains),
    section("SNI 一覧",           a.items.snIs),
    section("DNS クエリ一覧",     a.items.dnsQueries),
    section("宛先IP 一覧",        a.items.dstIPs),
    section("宛先ポート 一覧",    a.items.dstPorts, 30),
  );
  return lines.join("\n");
}

function bulkMarkdown(a: ComprehensiveAnalysis): string {
  const f  = a.filters ?? {};
  const fl = filterLines(f);
  const e  = a.enriched;
  const lines: string[] = [
    "# NetScope 取得結果",
    "",
    `> 生成日時: ${fmtDate(a.generatedAt)}`,
    "",
    "## フィルター条件",
    "",
    ...(fl.length > 0 ? fl.map((l) => `- ${l}`) : ["なし (全件)"]),
    "",
    "## 通信サマリー",
    "",
    "| 項目 | 値 |",
    "|------|-----|",
    `| 総通信数 | ${a.summary.total.toLocaleString()} |`,
    `| ユニークIP | ${a.summary.uniqueIPs.toLocaleString()} |`,
    `| ドメイン数 | ${a.summary.uniqueDomains.toLocaleString()} |`,
    "",
    "## プロトコル内訳",
    "",
    ...a.protocols.map((x) => `- **${x.protocol}**: ${x.count}件`),
  ];
  if (e && e.serviceSummary.length > 0) {
    lines.push("", "## サービスカテゴリ", "", "| サービス | 件数 |", "|---------|------|");
    for (const s of e.serviceSummary) {
      lines.push(`| ${CATEGORY_LABEL[s.category] ?? s.category} | ${s.count.toLocaleString()} |`);
    }
  }
  if (e && e.operationTimeline.length > 0) {
    lines.push("", "## 操作推定タイムライン", "");
    for (const ev of e.operationTimeline) {
      lines.push(`- **${ev.time}** ${ev.action}${ev.domain ? ` — \`${ev.domain}\`` : ""}`);
    }
  }
  lines.push(
    sectionMd("代表ドメイン一覧",  a.items.representativeDomains),
    sectionMd("ドメイン一覧",       a.items.domains),
    sectionMd("SNI 一覧",           a.items.snIs),
    sectionMd("DNS クエリ一覧",     a.items.dnsQueries),
    sectionMd("宛先IP 一覧",        a.items.dstIPs),
    sectionMd("宛先ポート 一覧",    a.items.dstPorts, 30),
    "",
    "---",
    "*Generated by NetScope*",
  );
  return lines.join("\n");
}

function bulkJson(a: ComprehensiveAnalysis): string {
  return JSON.stringify(a, null, 2);
}

// 個別タブ用コピー
function tabText(tab: TabDef, items: InfoItem[]): string {
  return [
    `# ${tab.label}一覧 (${items.length}種類)`,
    "",
    ...items.map((it, i) => `${i + 1}. ${it.value} (${it.count}件)`),
  ].join("\n");
}

function tabMarkdown(tab: TabDef, items: InfoItem[]): string {
  return [
    `## ${tab.label}一覧`,
    "", `> ${tab.description}`, "",
    `| # | ${tab.label} | 件数 |`,
    `|---|${"".padEnd(tab.label.length + 2, "-")}|------|`,
    ...items.map((it, i) => `| ${i + 1} | \`${it.value}\` | ${it.count} |`),
  ].join("\n");
}

function tabJson(tab: TabDef, items: InfoItem[]): string {
  return JSON.stringify({ category: tab.label, total: items.length, items }, null, 2);
}

// ─── コンポーネント ───────────────────────────────────────────────────────────

const ITEM_PAGE = 20;

type Props = {
  analysis: ComprehensiveAnalysis | null;
  loading?: boolean;
  onFilter: (f: Partial<PacketFilters>) => void;
  onRefresh?: () => void;
};

export function CapturedInfo({ analysis, loading, onFilter, onRefresh }: Props) {
  const [open,        setOpen]       = useState(false);
  const [tab,         setTab]        = useState<TabKey>("all");
  const [showAll,     setShowAll]    = useState(false);
  const [copyFmt,     setCopyFmt]    = useState<"text" | "md" | "json" | null>(null);
  const [copyState,   setCopyState]  = useState<"idle" | "ok" | "fail">("idle");
  const textareaRef                  = useRef<HTMLTextAreaElement>(null);

  function changeTab(key: TabKey) {
    setTab(key);
    setShowAll(false);
    setCopyFmt(null);
    setCopyState("idle");
  }

  async function handleCopy(text: string) {
    if (!text) return;
    const ok = await copyToClipboard(text);
    setCopyState(ok ? "ok" : "fail");
    setTimeout(() => setCopyState("idle"), 2500);
  }

  const items      = analysis?.items ?? null;
  // items に新しいタブキーが未定義の場合は空配列にフォールバック
  const currentTab = TABS.find((t) => t.key === tab)!;

  // 個別タブのデータ
  type ItemTabKey = Exclude<TabKey, "all">;
  const tabItems: InfoItem[] = (tab !== "all" && items)
    ? ((items[tab as ItemTabKey] as InfoItem[] | undefined) ?? [])
    : [];
  const visibleItems = showAll ? tabItems : tabItems.slice(0, ITEM_PAGE);
  const hasMore      = tabItems.length > ITEM_PAGE && !showAll;

  // コピー用テキスト
  const copyText = (() => {
    if (!analysis || !copyFmt) return "";
    if (tab === "all") {
      if (copyFmt === "text") return bulkText(analysis);
      if (copyFmt === "md")   return bulkMarkdown(analysis);
      return bulkJson(analysis);
    }
    if (copyFmt === "text") return tabText(currentTab, tabItems);
    if (copyFmt === "md")   return tabMarkdown(currentTab, tabItems);
    return tabJson(currentTab, tabItems);
  })();

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 overflow-hidden">
      {/* ── ヘッダー ─────────────────────────────────────────────────────── */}
      <button
        onClick={() => { setOpen((v) => !v); setShowAll(false); }}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
      >
        <span className="flex items-center gap-2 font-medium">
          <span className="text-green-400">🔍</span>
          取得できた情報の一覧
          {items && (
            <span className="text-xs text-slate-500 font-normal">
              ドメイン {items.domains.length}種 / IP {items.dstIPs.length}種
            </span>
          )}
          {loading && (
            <span className="animate-spin inline-block h-3 w-3 border border-slate-500 border-t-green-400 rounded-full" />
          )}
        </span>
        <span className="text-slate-500 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {/* ── パネル本体 ───────────────────────────────────────────────────── */}
      {open && (
        <div className="border-t border-slate-800">
          {/* ローディング */}
          {loading && !items && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-400">
              <span className="animate-spin inline-block h-3 w-3 border border-slate-500 border-t-green-400 rounded-full" />
              集計中...
            </div>
          )}
          {!loading && !items && (
            <div className="px-4 py-3 text-sm text-slate-500">データがありません</div>
          )}

          {items && (
            <>
              {/* ── タブバー ─────────────────────────────────────────── */}
              <div className="flex overflow-x-auto border-b border-slate-800 bg-slate-900">
                {TABS.map((t) => {
                  const count = t.key === "all"
                    ? Object.values(items).reduce((s, arr) => s + (arr as InfoItem[]).length, 0)
                    : ((items[t.key as Exclude<TabKey, "all">] as InfoItem[] | undefined) ?? []).length;
                  const isActive = tab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => changeTab(t.key)}
                      className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                        isActive
                          ? "border-blue-500 text-blue-300 bg-slate-800"
                          : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                      }`}
                    >
                      <span aria-hidden>{t.emoji}</span>
                      {t.label}
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        isActive ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-400"
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* ── コンテンツ ────────────────────────────────────────── */}
              <div className="p-4 flex flex-col gap-3">
                {/* コピーコントロール */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">{currentTab.description}</p>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-xs text-slate-600 mr-0.5">コピー:</span>
                    {(["text", "md", "json"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setCopyFmt(copyFmt === fmt ? null : fmt)}
                        className={`px-2 py-1 text-xs rounded border transition-colors ${
                          copyFmt === fmt
                            ? "border-blue-600 bg-blue-950 text-blue-300"
                            : "border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700"
                        }`}
                      >
                        {fmt === "text" ? "テキスト" : fmt === "md" ? "MD" : "JSON"}
                      </button>
                    ))}
                    {onRefresh && (
                      <button
                        onClick={onRefresh}
                        disabled={loading}
                        className="ml-1 px-2 py-1 text-xs rounded border border-slate-700 bg-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors"
                        title="再取得"
                      >↻</button>
                    )}
                  </div>
                </div>

                {/* コピー用テキストエリア */}
                {copyFmt && (
                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      readOnly
                      value={copyText}
                      rows={Math.min(16, copyText.split("\n").length + 1)}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300 font-mono resize-y focus:outline-none"
                      onClick={(e) => {
                        const ta = e.target as HTMLTextAreaElement;
                        ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length);
                      }}
                    />
                    <button
                      onClick={() => handleCopy(copyText)}
                      className={`absolute top-2 right-2 px-2.5 py-1 text-xs rounded transition-colors font-medium ${
                        copyState === "ok"
                          ? "bg-green-800 text-green-200"
                          : copyState === "fail"
                          ? "bg-red-800 text-red-200"
                          : "bg-slate-700 text-slate-400 hover:bg-slate-600 active:bg-slate-500"
                      }`}
                    >
                      {copyState === "ok" ? "✓ 完了" : copyState === "fail" ? "✗ 失敗" : "コピー"}
                    </button>
                    {copyState === "fail" && (
                      <p className="mt-1 text-xs text-red-400">
                        自動コピー失敗。テキストエリアを選択 → 手動コピーしてください。
                      </p>
                    )}
                  </div>
                )}

                {/* ── 全情報タブ ───────────────────────────────────────── */}
                {tab === "all" && analysis && (
                  <AllInfoView analysis={analysis} onFilter={onFilter} />
                )}

                {/* ── 個別タブ ─────────────────────────────────────────── */}
                {tab !== "all" && (
                  <>
                    {tabItems.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">データがありません</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                          {visibleItems.map((item, i) => (
                            <ItemRow
                              key={item.value}
                              rank={i + 1}
                              item={item}
                              tabKey={tab}
                              maxCount={tabItems[0]?.count ?? 1}
                              onFilter={() => currentTab.filterKey && onFilter({ [currentTab.filterKey]: item.value })}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-3 pt-1">
                          {hasMore && (
                            <button
                              onClick={() => setShowAll(true)}
                              className="text-xs text-blue-400 hover:text-blue-200 transition-colors"
                            >
                              ▼ 残り {tabItems.length - ITEM_PAGE} 件を表示
                            </button>
                          )}
                          {showAll && tabItems.length > ITEM_PAGE && (
                            <button
                              onClick={() => setShowAll(false)}
                              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                            >
                              ▲ 折りたたむ
                            </button>
                          )}
                          <span className="ml-auto text-xs text-slate-600">
                            {tabItems.length} 種類 / {tabItems.reduce((s, it) => s + it.count, 0).toLocaleString()} 件
                          </span>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 全情報ビュー ─────────────────────────────────────────────────────────────

function AllInfoView({
  analysis,
  onFilter,
}: {
  analysis: ComprehensiveAnalysis;
  onFilter: (f: Partial<PacketFilters>) => void;
}) {
  const f  = analysis.filters ?? {};
  const fl = filterLines(f);

  return (
    <div className="flex flex-col gap-4">
      {/* サマリー */}
      <div className="grid grid-cols-3 gap-2">
        <StatChip label="総通信数" value={analysis.summary.total.toLocaleString()} />
        <StatChip label="ユニークIP" value={analysis.summary.uniqueIPs.toLocaleString()} />
        <StatChip label="ドメイン数" value={analysis.summary.uniqueDomains.toLocaleString()} />
      </div>

      {/* フィルター条件 */}
      {fl.length > 0 && (
        <div className="rounded border border-slate-800 bg-slate-800/50 px-3 py-2 text-xs text-slate-400">
          <span className="text-slate-500 font-medium mr-2">フィルター条件:</span>
          {fl.join(" / ")}
        </div>
      )}

      {/* プロトコル内訳 */}
      {analysis.protocols.length > 0 && (
        <MiniSection title="プロトコル内訳" emoji="📶">
          <div className="flex flex-wrap gap-1.5">
            {analysis.protocols.map((p) => (
              <button
                key={p.protocol}
                onClick={() => onFilter({ protocol: p.protocol })}
                className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs hover:border-blue-600 hover:bg-blue-950/30 transition-colors"
                title={`プロトコル ${p.protocol} で絞り込む`}
              >
                <span className="font-mono text-slate-200">{p.protocol}</span>
                <span className="text-slate-500">{p.count.toLocaleString()}</span>
              </button>
            ))}
          </div>
        </MiniSection>
      )}

      {/* サービスカテゴリ */}
      {analysis.items.serviceCategories.length > 0 && (
        <MiniSection title="サービスカテゴリ" emoji="🏷">
          <div className="flex flex-wrap gap-1.5">
            {analysis.items.serviceCategories.map((item) => (
              <div
                key={item.value}
                className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ${CATEGORY_COLOR[item.value as ServiceCategory] ?? "bg-slate-700/20 text-slate-400 border-slate-700/40"}`}
              >
                <span className="font-medium">{CATEGORY_LABEL[item.value as ServiceCategory] ?? item.value}</span>
                <span className="opacity-60">{item.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </MiniSection>
      )}

      {/* 代表ドメイン Top10 */}
      {analysis.items.representativeDomains.length > 0 && (
        <MiniSection title={`代表ドメイン (${analysis.items.representativeDomains.length}種類)`} emoji="🌍">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {analysis.items.representativeDomains.slice(0, 10).map((item, i) => (
              <ItemRow
                key={item.value}
                rank={i + 1}
                item={item}
                tabKey="representativeDomains"
                maxCount={analysis.items.representativeDomains[0]?.count ?? 1}
                onFilter={() => onFilter({ search: item.value })}
              />
            ))}
          </div>
          {analysis.items.representativeDomains.length > 10 && (
            <p className="mt-1 text-xs text-slate-600">... 他 {analysis.items.representativeDomains.length - 10} 種類 (上のタブで全件確認)</p>
          )}
        </MiniSection>
      )}

      {/* 各カテゴリ (top 10 表示) */}
      {[
        { key: "domains",    label: "ホスト名",     emoji: "🌐", filterKey: "search"   as const },
        { key: "snIs",       label: "SNI",          emoji: "🔐", filterKey: "search"   as const },
        { key: "dnsQueries", label: "DNS クエリ",   emoji: "📡", filterKey: "search"   as const },
        { key: "dstIPs",     label: "宛先IP",       emoji: "🖥", filterKey: "dstIp"   as const },
        { key: "dstPorts",   label: "宛先ポート",   emoji: "🔢", filterKey: "dstPort"  as const },
      ].map(({ key, label, emoji, filterKey }) => {
        const cat = (analysis.items[key as keyof typeof analysis.items] as InfoItem[] | undefined) ?? [];
        if (!cat.length) return null;
        const top10 = cat.slice(0, 10);
        return (
          <MiniSection key={key} title={`${label} (${cat.length}種類)`} emoji={emoji}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {top10.map((item, i) => (
                <ItemRow
                  key={item.value}
                  rank={i + 1}
                  item={item}
                  tabKey={key as TabKey}
                  maxCount={cat[0]?.count ?? 1}
                  onFilter={() => onFilter({ [filterKey]: item.value })}
                />
              ))}
            </div>
            {cat.length > 10 && (
              <p className="mt-1 text-xs text-slate-600">... 他 {cat.length - 10} 種類 (上のタブで全件確認)</p>
            )}
          </MiniSection>
        );
      })}
    </div>
  );
}

// ─── 小パーツ ─────────────────────────────────────────────────────────────────

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-700 bg-slate-800 px-3 py-2 flex flex-col gap-0.5 text-center">
      <span className="text-[10px] text-slate-500">{label}</span>
      <span className="text-sm font-mono font-bold text-slate-100">{value}</span>
    </div>
  );
}

function MiniSection({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 mb-1.5">
        <span className="mr-1">{emoji}</span>{title}
      </p>
      {children}
    </div>
  );
}

function ItemRow({
  rank, item, tabKey, maxCount, onFilter,
}: {
  rank: number;
  item: InfoItem;
  tabKey: TabKey;
  maxCount: number;
  onFilter: () => void;
}) {
  const pct = maxCount > 0 ? Math.round((item.count / maxCount) * 100) : 0;
  const portLabel = tabKey === "dstPorts" ? PORT_LABELS[item.value] : undefined;

  return (
    <button
      onClick={onFilter}
      title={`「${item.value}」で絞り込む`}
      className="group flex items-center gap-2 rounded border border-slate-800 bg-slate-800/40 px-2.5 py-1.5 text-left hover:border-blue-600 hover:bg-blue-950/30 transition-colors"
    >
      <span className="shrink-0 w-5 text-right text-[10px] text-slate-600 font-mono">{rank}</span>
      <div className="relative h-1.5 w-8 shrink-0 rounded-full bg-slate-700 overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-blue-500/60 group-hover:bg-blue-400 transition-colors"
          style={{ width: `${Math.max(4, pct)}%` }}
        />
      </div>
      <span className="flex-1 min-w-0 truncate text-xs font-mono text-slate-200 group-hover:text-white">
        {item.value}
        {portLabel && <span className="ml-1 text-[10px] text-slate-500 font-sans">({portLabel})</span>}
      </span>
      <span className="shrink-0 text-[10px] font-mono text-slate-500 group-hover:text-slate-300">
        {item.count.toLocaleString()}
      </span>
      <span className="shrink-0 text-[10px] text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">▼</span>
    </button>
  );
}

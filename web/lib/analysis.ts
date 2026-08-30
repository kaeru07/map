/**
 * analysis.ts
 * クライアントサイドで Packet[] → ComprehensiveAnalysis を計算する純粋関数。
 * API を呼ばず、page.tsx が持つ filteredPackets から直接生成する。
 */

import {
  getServiceCategory,
  AUTH_KEYWORDS,
  VIDEO_KEYWORDS,
  SYNC_KEYWORDS,
} from "./categories";
import type {
  ActionEvent,
  BytesRanking,
  ComprehensiveAnalysis,
  Confidence,
  DnsCorrelation,
  EnrichedAnalysis,
  FlowView,
  InfoItem,
  OperationHint,
  Packet,
  PacketFilters,
  QuicFlow,
  ServiceCategory,
  ServiceSummary,
  SessionTag,
  TcpSession,
  TlsSession,
  TrafficFlow,
} from "./types";

// ─── ユーティリティ ───────────────────────────────────────────────────────────

function toSortedItems(m: Map<string, number>, limit = 200): InfoItem[] {
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

const RE_PRIVATE = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/;
const IPHONE_IPS = new Set(["10.0.0.2", "10.8.0.2"]);

// 一般的なポート (unusualPort タグ判定用)
const COMMON_PORTS = new Set([
  21, 22, 25, 53, 80, 110, 123, 143,
  443, 465, 587, 993, 995,
  3306, 3389, 5432, 6379,
  8080, 8443, 51820,
]);

// セッションタグのしきい値
const TAG_LONG_SESSION_SECS  = 60;
const TAG_MANY_PACKETS_COUNT = 50;
const TLS_WINDOW_MS          = 60_000; // TLS セッション分割ウィンドウ

// ─── 代表ドメイン ─────────────────────────────────────────────────────────────

/**
 * パケットから代表ドメインを 1 つ決定する。
 * 優先順位: tlsSni > dnsQuery > hostName > null
 */
function getRepresentativeDomain(p: Packet): string | null {
  return p.tlsSni ?? p.dnsQuery ?? p.hostName ?? null;
}

// ─── likelyAction 推定 ────────────────────────────────────────────────────────

type ActionCandidate = {
  action: string;
  confidence: Confidence;
  evidence: string;
};

function inferAction(
  domain: string | null,
  category: ServiceCategory,
  protocol: string,
  bytes: number | null,
  tcpFlags: string | null | undefined,
): ActionCandidate {
  const d = (domain ?? "").toLowerCase();
  const b = bytes ?? 0;

  // ── 高信頼度 ─────────────────────────────────────────────────────────────

  if (category === "OpenAI") {
    return { action: "ChatGPT / AI利用", confidence: "high", evidence: `ドメイン: ${domain}` };
  }
  if (category === "Twitch") {
    if (d.includes("video-weaver") || d.includes("jtvnw") || b > 50_000) {
      return { action: "Twitch 動画視聴", confidence: "high", evidence: `ドメイン: ${domain}, bytes: ${b}` };
    }
    return { action: "Twitch 利用", confidence: "high", evidence: `ドメイン: ${domain}` };
  }
  if (category === "LINE") {
    return { action: "LINE 通信", confidence: "high", evidence: `ドメイン: ${domain}` };
  }

  // ── 認証 / ログイン ───────────────────────────────────────────────────────
  if (AUTH_KEYWORDS.some((k) => d.includes(k))) {
    return { action: "認証 / ログイン", confidence: "high", evidence: `ドメイン: ${domain} (認証キーワード)` };
  }

  // ── 動画視聴 ─────────────────────────────────────────────────────────────
  if (
    category === "Video" ||
    (category === "Google" && VIDEO_KEYWORDS.some((k) => d.includes(k))) ||
    VIDEO_KEYWORDS.some((k) => d.includes(k))
  ) {
    if (b > 100_000) {
      return { action: "動画視聴 (大量受信)", confidence: "high", evidence: `ドメイン: ${domain}, bytes: ${b}` };
    }
    return { action: "動画視聴っぽい", confidence: "medium", evidence: `ドメイン: ${domain}` };
  }

  // ── Apple バックグラウンド同期 ─────────────────────────────────────────────
  if (category === "Apple") {
    if (SYNC_KEYWORDS.some((k) => d.includes(k))) {
      return { action: "バックグラウンド同期 (Apple)", confidence: "high", evidence: `ドメイン: ${domain}` };
    }
    return { action: "Apple サービス通信", confidence: "medium", evidence: `ドメイン: ${domain}` };
  }

  // ── Brave ─────────────────────────────────────────────────────────────────
  if (category === "Brave") {
    if (d.includes("search")) {
      return { action: "Brave 検索", confidence: "high", evidence: `ドメイン: ${domain}` };
    }
    return { action: "Brave ブラウジング", confidence: "medium", evidence: `ドメイン: ${domain}` };
  }

  // ── トラッキング ──────────────────────────────────────────────────────────
  if (category === "Tracking") {
    return { action: "計測 / トラッキング", confidence: "high", evidence: `ドメイン: ${domain}` };
  }

  // ── CDN 大容量 ────────────────────────────────────────────────────────────
  if (category === "CDN" && b > 100_000) {
    return { action: "コンテンツ配信 (CDN)", confidence: "medium", evidence: `ドメイン: ${domain}, bytes: ${b}` };
  }

  // ── Google 検索 ───────────────────────────────────────────────────────────
  if (category === "Google") {
    if (d.includes("search") || d.includes("query") || d === "www.google.com") {
      return { action: "Google 検索", confidence: "medium", evidence: `ドメイン: ${domain}` };
    }
    return { action: "Google サービス利用", confidence: "medium", evidence: `ドメイン: ${domain}` };
  }

  // ── DNS ──────────────────────────────────────────────────────────────────
  if (protocol === "DNS") {
    return { action: "DNS 名前解決", confidence: "high", evidence: `DNS クエリ: ${domain}` };
  }

  // ── 大容量転送 ────────────────────────────────────────────────────────────
  if (b > 200_000) {
    return { action: "大容量データ転送", confidence: "medium", evidence: `bytes: ${b}` };
  }
  if (b > 50_000) {
    return { action: "中容量データ転送", confidence: "low", evidence: `bytes: ${b}` };
  }

  // ── TLS/HTTPS ────────────────────────────────────────────────────────────
  if (protocol === "TLS" || protocol === "HTTPS") {
    if (domain) {
      return { action: "ウェブ閲覧っぽい", confidence: "low", evidence: `ドメイン: ${domain}` };
    }
    return { action: "暗号化通信", confidence: "low", evidence: `プロトコル: ${protocol}` };
  }

  // ── TCP SYN (接続開始) ───────────────────────────────────────────────────
  if (tcpFlags && tcpFlags.includes("SYN") && !tcpFlags.includes("ACK")) {
    return { action: "TCP 接続開始", confidence: "low", evidence: `TCP SYN` };
  }

  return { action: "一般通信", confidence: "low", evidence: `プロトコル: ${protocol}` };
}

// ─── DNS → 後続通信 関連付け ──────────────────────────────────────────────────

const DNS_FOLLOWUP_WINDOW_MS = 30_000; // 30 秒以内

function correlateDns(packets: Packet[]): DnsCorrelation[] {
  const dnsPackets = packets.filter((p) => p.protocol === "DNS" && p.dnsQuery);
  const nonDns    = packets.filter((p) => p.protocol !== "DNS");

  return dnsPackets
    .map((dns) => {
      const dnsTs  = new Date(dns.timestamp).getTime();
      const respIps = (dns.dnsResp ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const followups = nonDns
        .filter((p) => {
          const diff = new Date(p.timestamp).getTime() - dnsTs;
          if (diff < 0 || diff > DNS_FOLLOWUP_WINDOW_MS) return false;
          // dstIp が DNS レスポンス IP に含まれる、または同じドメイン
          const domain = getRepresentativeDomain(p);
          const ipMatch = respIps.length > 0 && respIps.includes(p.dstIp);
          const domainMatch =
            domain != null &&
            dns.dnsQuery != null &&
            (domain === dns.dnsQuery ||
              domain.endsWith("." + dns.dnsQuery) ||
              dns.dnsQuery.endsWith("." + domain));
          return ipMatch || domainMatch;
        })
        .slice(0, 10) // 最大 10 件
        .map((p) => {
          const d = getRepresentativeDomain(p);
          return {
            timestamp: p.timestamp,
            dstIp: p.dstIp,
            protocol: p.protocol,
            bytes: p.bytes,
            domain: d,
            serviceCategory: getServiceCategory(d),
          };
        });

      if (followups.length === 0) return null; // 後続なし → 除外

      return {
        dnsQuery: dns.dnsQuery!,
        dnsTimestamp: dns.timestamp,
        dnsResponseIps: respIps,
        followups,
      };
    })
    .filter(Boolean) as DnsCorrelation[];
}

// ─── フロー整理 ───────────────────────────────────────────────────────────────

const FLOW_WINDOW_MS = 60_000; // 60 秒以内を同一フローとみなす

function buildFlows(packets: Packet[]): TrafficFlow[] {
  // キー: representativeDomain || dstIp + "|" + dstPort + "|" + protocol
  const flowMap = new Map<
    string,
    {
      packets: Packet[];
      domain: string | null;
      category: ServiceCategory;
    }
  >();

  for (const p of packets) {
    const domain = getRepresentativeDomain(p);
    const cat    = getServiceCategory(domain);
    const key    = `${domain ?? p.dstIp}|${p.dstPort ?? ""}|${p.protocol}`;

    if (!flowMap.has(key)) {
      flowMap.set(key, { packets: [], domain, category: cat });
    }
    flowMap.get(key)!.packets.push(p);
  }

  const flows: TrafficFlow[] = [];
  let idx = 0;

  for (const [, flow] of flowMap) {
    // タイムスタンプ順にソート
    flow.packets.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // 60 秒ウィンドウで分割
    let windowStart = 0;
    while (windowStart < flow.packets.length) {
      const startTs = new Date(flow.packets[windowStart].timestamp).getTime();
      let windowEnd = windowStart;
      while (
        windowEnd + 1 < flow.packets.length &&
        new Date(flow.packets[windowEnd + 1].timestamp).getTime() - startTs < FLOW_WINDOW_MS
      ) {
        windowEnd++;
      }

      const group = flow.packets.slice(windowStart, windowEnd + 1);
      const totalBytes = group.reduce((s, p) => s + (p.bytes ?? 0), 0);
      const firstP = group[0];
      const lastP  = group[group.length - 1];

      // フローの代表 likelyAction
      const candidate = inferAction(
        flow.domain,
        flow.category,
        firstP.protocol,
        totalBytes,
        firstP.tcpFlags,
      );

      flows.push({
        id: String(++idx),
        representativeDomain: flow.domain,
        serviceCategory: flow.category,
        dstIp: firstP.dstIp,
        dstPort: firstP.dstPort,
        protocol: firstP.protocol,
        packetCount: group.length,
        totalBytes,
        firstSeen: firstP.timestamp,
        lastSeen: lastP.timestamp,
        direction: firstP.direction,
        likelyAction: candidate.action,
      });

      windowStart = windowEnd + 1;
    }
  }

  // 開始時刻順
  flows.sort(
    (a, b) => new Date(a.firstSeen).getTime() - new Date(b.firstSeen).getTime()
  );

  return flows;
}

// ─── 操作推定 ─────────────────────────────────────────────────────────────────

function buildOperations(packets: Packet[]): OperationHint[] {
  const hints: OperationHint[] = [];

  for (const p of packets) {
    const domain = getRepresentativeDomain(p);
    const cat    = getServiceCategory(domain);
    const cand   = inferAction(domain, cat, p.protocol, p.bytes, p.tcpFlags);

    // 低信頼 & DNS を除外してノイズ削減
    if (cand.confidence === "low" && p.protocol === "DNS") continue;
    if (cand.action === "一般通信" && cand.confidence === "low") continue;

    hints.push({
      likelyAction: cand.action,
      representativeDomain: domain,
      serviceCategory: cat,
      confidence: cand.confidence,
      timestamp: p.timestamp,
      evidence: cand.evidence,
    });
  }

  // タイムスタンプ順
  hints.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return hints;
}

// ─── タイムライン（1分バケット集約） ─────────────────────────────────────────

function buildTimeline(operations: OperationHint[]): ActionEvent[] {
  // 1分バケットに集約して最も信頼度の高いアクションを代表とする
  const buckets = new Map<
    string,
    { best: OperationHint; timestamp: string }
  >();

  const CONFIDENCE_RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };

  for (const op of operations) {
    const d  = new Date(op.timestamp);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const bucket = `${hh}:${mm}`;

    const existing = buckets.get(bucket);
    if (
      !existing ||
      CONFIDENCE_RANK[op.confidence] > CONFIDENCE_RANK[existing.best.confidence] ||
      // 同信頼度なら "一般通信" より具体的なものを優先
      (CONFIDENCE_RANK[op.confidence] === CONFIDENCE_RANK[existing.best.confidence] &&
        op.likelyAction !== "一般通信")
    ) {
      buckets.set(bucket, { best: op, timestamp: op.timestamp });
    }
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, { best, timestamp }]) => ({
      time,
      timestamp,
      action: best.likelyAction,
      category: best.serviceCategory,
      domain: best.representativeDomain,
      confidence: best.confidence,
    }));
}

// ─── サービス別サマリー ───────────────────────────────────────────────────────

function buildServiceSummary(packets: Packet[]): ServiceSummary[] {
  const map = new Map<
    ServiceCategory,
    { count: number; bytes: number; domains: Set<string> }
  >();

  for (const p of packets) {
    const domain = getRepresentativeDomain(p);
    const cat    = getServiceCategory(domain);
    if (!map.has(cat)) {
      map.set(cat, { count: 0, bytes: 0, domains: new Set() });
    }
    const entry = map.get(cat)!;
    entry.count++;
    entry.bytes += p.bytes ?? 0;
    if (domain) entry.domains.add(domain);
  }

  return [...map.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([category, { count, bytes, domains }]) => ({
      category,
      count,
      bytes,
      topDomains: [...domains].slice(0, 5),
    }));
}

// ─── 通信量ランキング ─────────────────────────────────────────────────────────

function buildBytesRanking(packets: Packet[]): BytesRanking[] {
  const map = new Map<string, { bytes: number; count: number; cat: ServiceCategory }>();

  for (const p of packets) {
    if (!p.bytes) continue;
    const domain = getRepresentativeDomain(p) ?? p.dstIp;
    const cat    = getServiceCategory(domain);
    if (!map.has(domain)) {
      map.set(domain, { bytes: 0, count: 0, cat });
    }
    const entry = map.get(domain)!;
    entry.bytes += p.bytes;
    entry.count++;
  }

  return [...map.entries()]
    .sort((a, b) => b[1].bytes - a[1].bytes)
    .slice(0, 20)
    .map(([domain, { bytes, count, cat }]) => ({
      domain,
      bytes,
      count,
      serviceCategory: cat,
    }));
}

// ─── Phase 5: セッション解析ヘルパー ─────────────────────────────────────────

function makeTags(
  durationSecs: number,
  packetCount: number,
  dstPort: number | null,
  hasRst: boolean,
  hasSyn: boolean,
): SessionTag[] {
  const tags: SessionTag[] = [];
  if (durationSecs > TAG_LONG_SESSION_SECS)                      tags.push("longSession");
  if (packetCount   > TAG_MANY_PACKETS_COUNT)                    tags.push("manyPackets");
  if (dstPort != null && !COMMON_PORTS.has(dstPort))            tags.push("unusualPort");
  if (hasRst && !hasSyn)                                         tags.push("suspicious");
  return tags;
}

// ─── Phase 5-①: QUIC フロー ──────────────────────────────────────────────────

function buildQuicFlows(packets: Packet[]): QuicFlow[] {
  const map = new Map<string, Packet[]>();

  for (const p of packets) {
    // isQuicCandidate が true のもの、または protocol=QUIC のもの
    if (!p.isQuicCandidate && p.protocol !== "QUIC") continue;
    const key = p.quicFlowId ?? `quic_${p.srcIp}_${p.dstIp}_${p.dstPort ?? ""}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }

  return [...map.entries()]
    .map(([quicFlowId, pkts]) => {
      const sorted = pkts.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      const first = sorted[0];
      const last  = sorted[sorted.length - 1];
      const firstSeen    = first.timestamp;
      const lastSeen     = last.timestamp;
      const durationSecs = (new Date(lastSeen).getTime() - new Date(firstSeen).getTime()) / 1000;
      const totalBytes   = pkts.reduce((s, p) => s + (p.bytes ?? 0), 0);
      const domain       = pkts.map(getRepresentativeDomain).find(d => d != null) ?? null;
      const cat          = getServiceCategory(domain);
      const tags         = makeTags(durationSecs, pkts.length, first.dstPort, false, false);

      return {
        quicFlowId,
        srcIp: first.srcIp,
        dstIp: first.dstIp,
        dstPort: first.dstPort,
        packetCount: pkts.length,
        totalBytes,
        firstSeen,
        lastSeen,
        durationSecs,
        representativeDomain: domain,
        serviceCategory: cat,
        tags,
      };
    })
    .sort((a, b) => b.packetCount - a.packetCount);
}

// ─── Phase 5-②: TLS セッションタイムライン ──────────────────────────────────

function buildTlsSessionRecord(
  sessionKey: string,
  tlsSessionId: string | null,
  pkts: Packet[],
): TlsSession {
  const sorted = [...pkts].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const first        = sorted[0];
  const last         = sorted[sorted.length - 1];
  const firstSeen    = first.timestamp;
  const lastSeen     = last.timestamp;
  const durationSecs = (new Date(lastSeen).getTime() - new Date(firstSeen).getTime()) / 1000;
  const totalBytes   = pkts.reduce((s, p) => s + (p.bytes ?? 0), 0);
  const sni          = pkts.find(p => p.tlsSni)?.tlsSni ?? null;
  const tlsVersion   = pkts.find(p => p.tlsVersion)?.tlsVersion ?? null;
  const hasClientHello = pkts.some(p => p.tlsHandshake === "ClientHello");
  const cat          = getServiceCategory(sni);

  const relTimes = pkts
    .map(p => p.relativeTime)
    .filter((t): t is number => t != null);
  const relativeStart = relTimes.length > 0 ? Math.min(...relTimes) : null;
  const relativeEnd   = relTimes.length > 0 ? Math.max(...relTimes) : null;

  const tags = makeTags(durationSecs, pkts.length, first.dstPort, false, false);

  return {
    sessionKey,
    tlsSessionId,
    srcIp: first.srcIp,
    dstIp: first.dstIp,
    dstPort: first.dstPort,
    sni,
    tlsVersion,
    hasClientHello,
    serviceCategory: cat,
    firstSeen,
    lastSeen,
    relativeStart,
    relativeEnd,
    packetCount: pkts.length,
    totalBytes,
    tags,
  };
}

function buildTlsSessions(packets: Packet[]): TlsSession[] {
  // TLS 関連パケットのみ
  const tlsPackets = packets.filter(
    p => p.tlsSni || p.tlsHandshake || p.tlsVersion || p.tlsSessionId
  );
  if (tlsPackets.length === 0) return [];

  const sessions: TlsSession[] = [];
  const withoutSid: Packet[]   = [];

  // tlsSessionId があれば確実にグループ化
  const bySid = new Map<string, Packet[]>();
  for (const p of tlsPackets) {
    if (p.tlsSessionId) {
      if (!bySid.has(p.tlsSessionId)) bySid.set(p.tlsSessionId, []);
      bySid.get(p.tlsSessionId)!.push(p);
    } else {
      withoutSid.push(p);
    }
  }
  for (const [sid, pkts] of bySid) {
    sessions.push(buildTlsSessionRecord(`sid_${sid}`, sid, pkts));
  }

  // tlsSessionId がない場合は (srcIp|dstIp|dstPort) + 60s ウィンドウでグループ化
  const byKey = new Map<string, Packet[]>();
  for (const p of withoutSid) {
    // 双方向を同一セッションとして扱う
    const [a, b] = [p.srcIp, p.dstIp].sort();
    const key = `${a}|${b}|${p.dstPort ?? ""}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(p);
  }
  for (const [groupKey, pkts] of byKey) {
    pkts.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    let wStart = 0;
    let sIdx   = 0;
    while (wStart < pkts.length) {
      const startTs = new Date(pkts[wStart].timestamp).getTime();
      let wEnd = wStart;
      while (
        wEnd + 1 < pkts.length &&
        new Date(pkts[wEnd + 1].timestamp).getTime() - startTs < TLS_WINDOW_MS
      ) wEnd++;
      const group = pkts.slice(wStart, wEnd + 1);
      sessions.push(buildTlsSessionRecord(`key_${groupKey}_${sIdx++}`, null, group));
      wStart = wEnd + 1;
    }
  }

  return sessions
    .sort((a, b) => new Date(a.firstSeen).getTime() - new Date(b.firstSeen).getTime())
    .slice(0, 100);
}

// ─── Phase 5-③: TCP セッション (flowId ベース) ──────────────────────────────

function buildTcpSessions(packets: Packet[]): TcpSession[] {
  const map = new Map<
    string,
    { pkts: Packet[]; srcIp: string; dstIp: string; srcPort: number | null; dstPort: number | null; domain: string | null }
  >();

  for (const p of packets) {
    if (!p.flowId) continue;
    if (!map.has(p.flowId)) {
      map.set(p.flowId, {
        pkts:    [],
        srcIp:   p.srcIp,
        dstIp:   p.dstIp,
        srcPort: p.srcPort,
        dstPort: p.dstPort,
        domain:  getRepresentativeDomain(p),
      });
    }
    map.get(p.flowId)!.pkts.push(p);
  }

  return [...map.entries()]
    .map(([flowId, { pkts, srcIp, dstIp, srcPort, dstPort, domain }]) => {
      const sorted = pkts.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      const firstSeen    = sorted[0].timestamp;
      const lastSeen     = sorted[sorted.length - 1].timestamp;
      const durationSecs = (new Date(lastSeen).getTime() - new Date(firstSeen).getTime()) / 1000;
      const totalBytes   = pkts.reduce((s, p) => s + (p.bytes ?? 0), 0);
      const cat          = getServiceCategory(domain);

      // tcpSyn/Fin/Rst は DB 値を使う。なければ tcpFlags 文字列で補完
      const hasSyn = pkts.some(p => p.tcpSyn === true || (p.tcpSyn == null && p.tcpFlags?.includes("SYN") === true));
      const hasFin = pkts.some(p => p.tcpFin === true || (p.tcpFin == null && p.tcpFlags?.includes("FIN") === true));
      const hasRst = pkts.some(p => p.tcpRst === true || (p.tcpRst == null && p.tcpFlags?.includes("RST") === true));
      const tags   = makeTags(durationSecs, pkts.length, dstPort, hasRst, hasSyn);

      return {
        flowId,
        srcIp, dstIp, srcPort, dstPort,
        hasSyn, hasFin, hasRst,
        isComplete: hasSyn && hasFin,
        isReset:    hasRst,
        packetCount: pkts.length,
        totalBytes,
        firstSeen, lastSeen, durationSecs,
        representativeDomain: domain,
        serviceCategory: cat,
        tags,
      } satisfies TcpSession;
    })
    .sort((a, b) => b.packetCount - a.packetCount)
    .slice(0, 150);
}

// ─── Phase 5-④: flowId 別ビュー ──────────────────────────────────────────────

function buildFlowViews(packets: Packet[]): FlowView[] {
  const map = new Map<
    string,
    { pkts: Packet[]; srcIp: string; dstIp: string; dstPort: number | null; protocol: string; domain: string | null; direction: string | null }
  >();

  for (const p of packets) {
    if (!p.flowId) continue;
    if (!map.has(p.flowId)) {
      map.set(p.flowId, {
        pkts:      [],
        srcIp:     p.srcIp,
        dstIp:     p.dstIp,
        dstPort:   p.dstPort,
        protocol:  p.protocol,
        domain:    getRepresentativeDomain(p),
        direction: p.direction,
      });
    }
    map.get(p.flowId)!.pkts.push(p);
  }

  return [...map.entries()]
    .map(([flowId, { pkts, srcIp, dstIp, dstPort, protocol, domain, direction }]) => {
      const sorted       = pkts.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const firstSeen    = sorted[0].timestamp;
      const lastSeen     = sorted[sorted.length - 1].timestamp;
      const durationSecs = (new Date(lastSeen).getTime() - new Date(firstSeen).getTime()) / 1000;
      const totalBytes   = pkts.reduce((s, p) => s + (p.bytes ?? 0), 0);
      const cat          = getServiceCategory(domain);
      const hasRst       = pkts.some(p => p.tcpRst === true || p.tcpFlags?.includes("RST") === true);
      const hasSyn       = pkts.some(p => p.tcpSyn === true || p.tcpFlags?.includes("SYN") === true);
      const tags         = makeTags(durationSecs, pkts.length, dstPort, hasRst, hasSyn);

      return {
        flowId, srcIp, dstIp, dstPort, protocol, direction,
        representativeDomain: domain,
        serviceCategory: cat,
        packetCount: pkts.length,
        totalBytes, firstSeen, lastSeen, durationSecs, tags,
      } satisfies FlowView;
    })
    .sort((a, b) => b.packetCount - a.packetCount)
    .slice(0, 200);
}

// ─── メイン関数 ───────────────────────────────────────────────────────────────

/**
 * packets と現在のフィルター条件から ComprehensiveAnalysis を生成する。
 * すべての表示・コピー出力はこの関数の結果を唯一の元データとして使う。
 */
export function buildAnalysis(
  packets: Packet[],
  filters: PacketFilters
): ComprehensiveAnalysis {
  const ipSet         = new Set<string>();
  const domainCount   = new Map<string, number>();
  const protoCount    = new Map<string, number>();
  const hostNameCount = new Map<string, number>();
  const sniCount      = new Map<string, number>();
  const dnsCount      = new Map<string, number>();
  const dstIpCount    = new Map<string, number>();
  const dstPortCount  = new Map<string, number>();
  const catCount      = new Map<string, number>();
  const repDomCount   = new Map<string, number>();

  const recentDomains: string[] = [];
  const seenDomains   = new Set<string>();

  let vpnPackets    = 0;
  let iPhonePackets = 0;
  let totalBytes    = 0;

  for (const p of packets) {
    ipSet.add(p.srcIp);
    ipSet.add(p.dstIp);
    totalBytes += p.bytes ?? 0;

    // 代表ドメイン
    const repDomain = getRepresentativeDomain(p);
    const cat       = getServiceCategory(repDomain);

    // ドメイン集計 (SNI > dnsQuery > hostName の優先順)
    const domain = repDomain;
    if (domain) {
      domainCount.set(domain, (domainCount.get(domain) ?? 0) + 1);
      if (!seenDomains.has(domain) && recentDomains.length < 10) {
        seenDomains.add(domain);
        recentDomains.push(domain);
      }
    }

    // 個別集計
    protoCount.set(p.protocol, (protoCount.get(p.protocol) ?? 0) + 1);
    if (p.hostName) hostNameCount.set(p.hostName, (hostNameCount.get(p.hostName) ?? 0) + 1);
    if (p.tlsSni)   sniCount.set(p.tlsSni,   (sniCount.get(p.tlsSni)   ?? 0) + 1);
    if (p.dnsQuery) dnsCount.set(p.dnsQuery, (dnsCount.get(p.dnsQuery) ?? 0) + 1);
    dstIpCount.set(p.dstIp, (dstIpCount.get(p.dstIp) ?? 0) + 1);
    if (p.dstPort != null) {
      const k = String(p.dstPort);
      dstPortCount.set(k, (dstPortCount.get(k) ?? 0) + 1);
    }

    // サービスカテゴリ集計
    catCount.set(cat, (catCount.get(cat) ?? 0) + 1);

    // 代表ドメイン集計
    if (repDomain) {
      repDomCount.set(repDomain, (repDomCount.get(repDomain) ?? 0) + 1);
    }

    // VPN / iPhone
    if (RE_PRIVATE.test(p.srcIp) || RE_PRIVATE.test(p.dstIp)) vpnPackets++;
    if (IPHONE_IPS.has(p.srcIp) || IPHONE_IPS.has(p.dstIp)) iPhonePackets++;
  }

  const topDomains = [...domainCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, count }));

  // ── 強化分析 ─────────────────────────────────────────────────────────────

  const serviceSummary  = buildServiceSummary(packets);
  const bytesRanking    = buildBytesRanking(packets);
  const dnsCorrelations = correlateDns(packets);
  const flows           = buildFlows(packets);
  const operations      = buildOperations(packets);
  const timeline        = buildTimeline(operations);
  const quicFlows       = buildQuicFlows(packets);
  const tlsSessions     = buildTlsSessions(packets);
  const tcpSessions     = buildTcpSessions(packets);
  const flowViews       = buildFlowViews(packets);

  const enriched: EnrichedAnalysis = {
    totalBytes,
    serviceSummary,
    bytesRanking,
    operationTimeline: timeline,
    dnsCorrelations,
    estimatedOperations: operations.slice(0, 200),
    flows: flows.slice(0, 200),
    quicFlows,
    tlsSessions,
    tcpSessions,
    flowViews,
  };

  return {
    generatedAt: new Date().toISOString(),
    filters,
    summary: {
      total:         packets.length,
      uniqueIPs:     ipSet.size,
      uniqueDomains: domainCount.size,
    },
    topDomains,
    protocols: toSortedItems(protoCount).map(({ value, count }) => ({ protocol: value, count })),
    vpn: { vpnPackets, iPhonePackets },
    recentDomains,
    items: {
      domains:              toSortedItems(hostNameCount),
      snIs:                 toSortedItems(sniCount),
      dnsQueries:           toSortedItems(dnsCount),
      dstIPs:               toSortedItems(dstIpCount),
      protocols:            toSortedItems(protoCount),
      dstPorts:             toSortedItems(dstPortCount, 100),
      serviceCategories:    toSortedItems(catCount),
      representativeDomains: toSortedItems(repDomCount),
    },
    enriched,
  };
}

// ─── バイト表示ヘルパー ───────────────────────────────────────────────────────

export function fmtBytes(b: number): string {
  if (b >= 1_000_000) return `${(b / 1_000_000).toFixed(1)} MB`;
  if (b >= 1_000)     return `${(b / 1_000).toFixed(1)} KB`;
  return `${b} B`;
}

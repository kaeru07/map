/**
 * compare.ts
 * 防御前後のパケット配列を受け取り、差分サマリーを生成する純粋関数。
 * 外部APIに依存しない。/api/packets から取得した Packet[] を直接使う。
 */

import type { Packet } from "./types";

// ─── 定数 ────────────────────────────────────────────────────────────────────

/** 個別追跡するポート */
export const TRACKED_PORTS: { port: number; label: string; desc: string }[] = [
  { port: 21,  label: "FTP",   desc: "ファイル転送" },
  { port: 22,  label: "SSH",   desc: "リモートログイン" },
  { port: 80,  label: "HTTP",  desc: "Web (平文)" },
  { port: 443, label: "HTTPS", desc: "Web (暗号化)" },
];

// ─── 型定義 ──────────────────────────────────────────────────────────────────

export type DiffStatus = "blocked" | "reduced" | "increased" | "stable" | "new" | "none";

export type PortDiff = {
  port:   number | null;
  label:  string;
  desc:   string;
  before: number;
  after:  number;
  delta:  number;
  pct:    number;          // 変化率 (%)
  status: DiffStatus;
};

export type ProtoDiff = {
  protocol: string;
  before:   number;
  after:    number;
  delta:    number;
  status:   DiffStatus;
};

export type IpDiff = {
  ip:     string;
  before: number;
  after:  number;
  delta:  number;
};

export type Verdict = {
  port:    number | null;
  label:   string;
  level:   "success" | "warning" | "danger" | "info";
  icon:    string;
  message: string;
};

export type CompareResult = {
  beforeCount:   number;
  afterCount:    number;
  totalDelta:    number;
  ports:         PortDiff[];
  protocols:     ProtoDiff[];
  topSrcIps:     IpDiff[];
  verdicts:      Verdict[];
  beforePeriod:  { from: string; to: string };
  afterPeriod:   { from: string; to: string };
};

// ─── 集計ユーティリティ ───────────────────────────────────────────────────────

function countByDstPort(packets: Packet[]): Map<number | null, number> {
  const m = new Map<number | null, number>();
  for (const p of packets) {
    const port = p.dstPort ?? null;
    m.set(port, (m.get(port) ?? 0) + 1);
  }
  return m;
}

function countByProtocol(packets: Packet[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of packets) {
    m.set(p.protocol, (m.get(p.protocol) ?? 0) + 1);
  }
  return m;
}

function countBySrcIp(packets: Packet[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of packets) {
    m.set(p.srcIp, (m.get(p.srcIp) ?? 0) + 1);
  }
  return m;
}

function calcPct(before: number, after: number): number {
  if (before === 0) return after > 0 ? 100 : 0;
  return Math.round(((after - before) / before) * 100);
}

function toDiffStatus(before: number, after: number): DiffStatus {
  if (before === 0 && after === 0) return "none";
  if (before === 0 && after  > 0) return "new";
  if (before  > 0 && after === 0) return "blocked";
  const ratio = after / before;
  if (ratio < 0.5)  return "reduced";
  if (ratio > 1.5)  return "increased";
  return "stable";
}

// ─── メイン比較関数 ───────────────────────────────────────────────────────────

export function buildCompare(
  before:       Packet[],
  after:        Packet[],
  beforePeriod: { from: string; to: string },
  afterPeriod:  { from: string; to: string },
): CompareResult {

  const beforeByPort  = countByDstPort(before);
  const afterByPort   = countByDstPort(after);
  const beforeByProto = countByProtocol(before);
  const afterByProto  = countByProtocol(after);
  const beforeBySrc   = countBySrcIp(before);
  const afterBySrc    = countBySrcIp(after);

  // ── ポート差分 ──────────────────────────────────────────────────────────────
  const trackedSet = new Set(TRACKED_PORTS.map((t) => t.port));

  const ports: PortDiff[] = TRACKED_PORTS.map(({ port, label, desc }) => {
    const b = beforeByPort.get(port) ?? 0;
    const a = afterByPort.get(port)  ?? 0;
    return {
      port, label, desc,
      before: b, after: a,
      delta:  a - b,
      pct:    calcPct(b, a),
      status: toDiffStatus(b, a),
    };
  });

  // その他ポートの合算
  let otherB = 0, otherA = 0;
  for (const [port, count] of beforeByPort) {
    if (!trackedSet.has(port as number)) otherB += count;
  }
  for (const [port, count] of afterByPort) {
    if (!trackedSet.has(port as number)) otherA += count;
  }
  ports.push({
    port: null, label: "その他", desc: "非標準ポート",
    before: otherB, after: otherA,
    delta:  otherA - otherB,
    pct:    calcPct(otherB, otherA),
    status: toDiffStatus(otherB, otherA),
  });

  // ── プロトコル差分 ──────────────────────────────────────────────────────────
  const allProtos  = new Set([...beforeByProto.keys(), ...afterByProto.keys()]);
  const protocols: ProtoDiff[] = [...allProtos]
    .map((protocol) => {
      const b = beforeByProto.get(protocol) ?? 0;
      const a = afterByProto.get(protocol)  ?? 0;
      return { protocol, before: b, after: a, delta: a - b, status: toDiffStatus(b, a) };
    })
    .sort((x, y) => y.before - x.before);

  // ── 送信元IP差分 ────────────────────────────────────────────────────────────
  const allIps    = new Set([...beforeBySrc.keys(), ...afterBySrc.keys()]);
  const topSrcIps: IpDiff[] = [...allIps]
    .map((ip) => ({
      ip,
      before: beforeBySrc.get(ip) ?? 0,
      after:  afterBySrc.get(ip)  ?? 0,
      delta:  (afterBySrc.get(ip) ?? 0) - (beforeBySrc.get(ip) ?? 0),
    }))
    .sort((a, b) => b.before - a.before)
    .slice(0, 10);

  // ── 防御評価コメント（ルールベース） ────────────────────────────────────────
  const verdicts: Verdict[] = [];

  for (const pd of ports) {
    if (pd.port === null) continue;
    if (pd.before === 0 && pd.after === 0) continue; // 元々通信なし

    if (pd.status === "blocked") {
      verdicts.push({
        port: pd.port, label: pd.label, level: "success", icon: "✓",
        message: `${pd.label} (port ${pd.port}): ${pd.before}件 → 0件 — 遮断成功、通信が完全に消えました`,
      });
    } else if (pd.status === "reduced") {
      verdicts.push({
        port: pd.port, label: pd.label, level: "warning", icon: "↓",
        message: `${pd.label} (port ${pd.port}): ${pd.before}件 → ${pd.after}件 (${pd.pct}%) — 減少しましたが一部通過中`,
      });
    } else if (pd.status === "increased") {
      verdicts.push({
        port: pd.port, label: pd.label, level: "danger", icon: "↑",
        message: `${pd.label} (port ${pd.port}): ${pd.before}件 → ${pd.after}件 (+${pd.pct}%) — 増加中、防御されていません`,
      });
    } else if (pd.status === "stable" && pd.before > 0) {
      verdicts.push({
        port: pd.port, label: pd.label, level: "info", icon: "→",
        message: `${pd.label} (port ${pd.port}): ${pd.before}件 → ${pd.after}件 — 変化なし（継続中）`,
      });
    } else if (pd.status === "new") {
      verdicts.push({
        port: pd.port, label: pd.label, level: "danger", icon: "!",
        message: `${pd.label} (port ${pd.port}): 新たに ${pd.after}件 出現 — 防御後に開始された通信`,
      });
    }
  }

  // 全体総評
  const totalDelta = after.length - before.length;
  if (verdicts.length === 0) {
    verdicts.push({
      port: null, label: "全体", level: "info", icon: "—",
      message: "監視対象ポートに通信なし。攻撃シナリオを実行してから比較してください。",
    });
  } else if (totalDelta < 0) {
    verdicts.unshift({
      port: null, label: "総評", level: "success", icon: "★",
      message: `総通信数が ${Math.abs(totalDelta)} 件減少しました（${before.length}件 → ${after.length}件）`,
    });
  } else if (totalDelta > 0) {
    verdicts.unshift({
      port: null, label: "総評", level: "warning", icon: "★",
      message: `総通信数が ${totalDelta} 件増加しました（${before.length}件 → ${after.length}件）`,
    });
  } else {
    verdicts.unshift({
      port: null, label: "総評", level: "info", icon: "★",
      message: `総通信数に変化なし（${before.length}件 → ${after.length}件）`,
    });
  }

  return {
    beforeCount: before.length,
    afterCount:  after.length,
    totalDelta,
    ports,
    protocols,
    topSrcIps,
    verdicts,
    beforePeriod,
    afterPeriod,
  };
}

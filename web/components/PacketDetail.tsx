"use client";

import { useState } from "react";
import { Packet } from "@/lib/types";
import { ProtocolBadge } from "./ProtocolBadge";

type Props = {
  packet: Packet;
  onClose: () => void;
};

function Row({ label, value }: { label: string; value: string | number | null }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="flex gap-2 py-1.5 border-b border-slate-800 last:border-0">
      <span className="text-slate-500 text-xs w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-slate-200 font-mono text-sm break-all">{String(value)}</span>
    </div>
  );
}

function Section({ label }: { label: string }) {
  return (
    <div className="pt-3 pb-1 first:pt-0">
      <span className="text-[10px] font-semibold tracking-widest text-slate-600 uppercase">
        {label}
      </span>
    </div>
  );
}

export function PacketDetail({ packet, onClose }: Props) {
  const [tab, setTab] = useState<"detail" | "json">("detail");

  // rawJson は Prisma Json 型 (already parsed object) または null
  const rawJsonStr = packet.rawJson
    ? JSON.stringify(packet.rawJson, null, 2)
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <ProtocolBadge protocol={packet.protocol} />
          <span className="text-slate-400 text-sm font-mono">#{packet.id}</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-100 text-lg leading-none"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        {(["detail", "json"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm transition-colors ${
              tab === t
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t === "detail" ? "詳細" : "JSON"}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === "detail" ? (
          <div>
            <Section label="基本情報" />
            <Row label="タイムスタンプ" value={new Date(packet.timestamp).toLocaleString("ja-JP")} />
            <Row label="プロトコル"     value={packet.protocol} />
            <Row label="通信方向"       value={
              packet.direction === "outbound" ? "↑ アウトバウンド (送信)"
              : packet.direction === "inbound" ? "↓ インバウンド (受信)"
              : packet.direction ?? null
            } />
            <Row label="サイズ" value={packet.bytes !== null ? `${packet.bytes?.toLocaleString()} bytes` : null} />
            {packet.iface && <Row label="インターフェース" value={packet.iface} />}

            <Section label="通信経路" />
            <Row label="送信元 IP"   value={packet.srcIp} />
            <Row label="送信元ポート" value={packet.srcPort} />
            <Row label="宛先 IP"     value={packet.dstIp} />
            <Row label="宛先ポート"   value={packet.dstPort} />

            <Section label="ドメイン / SNI" />
            <Row label="ホスト名"    value={packet.hostName} />
            <Row label="TLS SNI"     value={packet.tlsSni} />
            <Row label="TLS バージョン" value={packet.tlsVersion ?? null} />

            <Section label="DNS" />
            <Row label="クエリ"    value={packet.dnsQuery} />
            <Row label="種別"      value={packet.dnsType ?? null} />
            <Row label="レスポンス" value={packet.dnsResp ?? null} />

            {(packet.httpMethod || packet.httpPath) && (
              <>
                <Section label="HTTP" />
                <Row label="メソッド" value={packet.httpMethod ?? null} />
                <Row label="パス"     value={packet.httpPath ?? null} />
              </>
            )}

            <Section label="フロー / セッション (v4)" />
            <Row label="フロー ID"     value={packet.flowId ?? null} />
            <Row label="相対時刻"      value={packet.relativeTime != null ? `${packet.relativeTime.toFixed(3)} 秒` : null} />
            {packet.isQuicCandidate && (
              <Row label="QUIC候補"    value="UDP + port 443" />
            )}
            <Row label="QUIC Flow ID"  value={packet.quicFlowId ?? null} />
            <Row label="TLSセッションID" value={packet.tlsSessionId ?? null} />
            {(packet.tcpSyn != null || packet.tcpFin != null || packet.tcpRst != null) && (
              <Row label="TCP フラグ詳細" value={[
                packet.tcpSyn ? "SYN" : null,
                packet.tcpFin ? "FIN" : null,
                packet.tcpRst ? "RST" : null,
              ].filter(Boolean).join(" | ") || null} />
            )}

            <Section label="メタ" />
            <Row label="ID"        value={packet.id} />
            <Row label="登録日時"   value={new Date(packet.createdAt).toLocaleString("ja-JP")} />
          </div>
        ) : (
          <pre className="text-xs text-green-300 font-mono bg-slate-900 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">
            {rawJsonStr ?? "(rawJson なし)"}
          </pre>
        )}
      </div>
    </div>
  );
}

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
      <span className="text-slate-500 text-xs w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-slate-200 font-mono text-sm break-all">{String(value)}</span>
    </div>
  );
}

export function PacketDetail({ packet, onClose }: Props) {
  const [tab, setTab] = useState<"detail" | "json">("detail");

  const parsed = (() => {
    if (!packet.rawJson) return null;
    try {
      return JSON.parse(packet.rawJson);
    } catch {
      return null;
    }
  })();

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
            <Row label="ID" value={packet.id} />
            <Row label="Timestamp" value={new Date(packet.timestamp).toLocaleString("ja-JP")} />
            <Row label="Protocol" value={packet.protocol} />
            <Row label="Src IP" value={packet.srcIp} />
            <Row label="Src Port" value={packet.srcPort} />
            <Row label="Dst IP" value={packet.dstIp} />
            <Row label="Dst Port" value={packet.dstPort} />
            <Row label="Bytes" value={packet.bytes !== null ? `${packet.bytes} bytes` : null} />
            <Row label="Direction" value={packet.direction} />
            <Row label="Host Name" value={packet.hostName} />
            <Row label="TLS SNI" value={packet.tlsSni} />
            <Row label="DNS Query" value={packet.dnsQuery} />
            <Row label="Created At" value={new Date(packet.createdAt).toLocaleString("ja-JP")} />
          </div>
        ) : (
          <pre className="text-xs text-green-300 font-mono bg-slate-900 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">
            {parsed
              ? JSON.stringify(parsed, null, 2)
              : packet.rawJson ?? "(rawJson なし)"}
          </pre>
        )}
      </div>
    </div>
  );
}

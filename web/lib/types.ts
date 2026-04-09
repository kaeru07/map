export type Packet = {
  id: string;
  timestamp: string; // ISO string
  srcIp: string;
  dstIp: string;
  srcPort: number | null;
  dstPort: number | null;
  protocol: string;
  bytes: number | null;
  direction: string | null;
  hostName: string | null;
  tlsSni: string | null;
  dnsQuery: string | null;
  rawJson: unknown;
  createdAt: string;
  updatedAt?: string;
};

export type PacketFilters = {
  protocol?: string;
  srcIp?: string;
  dstIp?: string;
  dstPort?: string;
  timeFrom?: string;
  timeTo?: string;
  search?: string;
};

export type PacketsResponse = {
  packets: Packet[];
  total: number;
  page: number;
  pageSize: number;
  demo?: boolean;
};

export type StatsResponse = {
  total: number;
  protocols: string[];
  latestTimestamp: string | null;
  demo?: boolean;
};

// ─── VPN ────────────────────────────────────────────────────────────────────

export type VpnClient = {
  /** WireGuard インターフェース名 (例: wg0) */
  interface: string;
  /** VPN IP (例: 10.0.0.2) */
  ip: string;
  /** 表示名 (例: iPhone) */
  name: string;
  /** エンドポイント (例: 114.48.193.198:61293) or null */
  endpoint: string | null;
  /** ハンドシェイク表示 (例: 5 秒前) */
  handshake: string;
  /** ハンドシェイク Unix タイムスタンプ */
  handshakeTs: number;
  /** 受信量 (人間可読) */
  rx: string;
  /** 送信量 (人間可読) */
  tx: string;
  /** 直近 3 分以内にハンドシェイクがあれば true */
  connected: boolean;
};

export type VpnStatusResponse = {
  clients: VpnClient[];
  error?: string;
};

// ─── VPN ヘルパー ────────────────────────────────────────────────────────────

/** srcIp / dstIp が VPN クライアント IP かどうか判定 */
export function isVpnIp(ip: string): boolean {
  return ip.startsWith("10.0.0.") && ip !== "10.0.0.1";
}

/** VPN IP から表示名を返す (既知の IP のみ) */
export const VPN_CLIENT_NAMES: Record<string, string> = {
  "10.0.0.2": "iPhone",
};

export const PROTOCOL_COLORS: Record<string, string> = {
  TCP: "text-blue-400",
  UDP: "text-green-400",
  DNS: "text-yellow-400",
  TLS: "text-purple-400",
  HTTP: "text-orange-400",
  HTTPS: "text-orange-500",
  ICMP: "text-gray-400",
  ARP: "text-pink-400",
};

export const PROTOCOL_BG: Record<string, string> = {
  TCP: "bg-blue-400/10 text-blue-300 border-blue-400/30",
  UDP: "bg-green-400/10 text-green-300 border-green-400/30",
  DNS: "bg-yellow-400/10 text-yellow-300 border-yellow-400/30",
  TLS: "bg-purple-400/10 text-purple-300 border-purple-400/30",
  HTTP: "bg-orange-400/10 text-orange-300 border-orange-400/30",
  HTTPS: "bg-orange-500/10 text-orange-200 border-orange-500/30",
  ICMP: "bg-gray-400/10 text-gray-300 border-gray-400/30",
  ARP: "bg-pink-400/10 text-pink-300 border-pink-400/30",
};

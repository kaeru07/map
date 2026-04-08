export type Packet = {
  id: number;
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
  rawJson: string | null;
  createdAt: string;
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
};

export type StatsResponse = {
  total: number;
  protocols: string[];
  latestTimestamp: string | null;
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

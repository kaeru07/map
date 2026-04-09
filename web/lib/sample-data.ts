import { Packet, StatsResponse } from "./types";

const BASE = "2026-04-09T10:00:00.000Z";
function ago(sec: number): string {
  return new Date(Date.parse(BASE) - sec * 1000).toISOString();
}

export const SAMPLE_PACKETS: Packet[] = [
  {
    id: "demo-1", timestamp: ago(0), srcIp: "10.8.0.2", dstIp: "1.1.1.1",
    srcPort: 54841, dstPort: 53, protocol: "DNS", bytes: 72,
    direction: "outbound", hostName: null, tlsSni: null,
    dnsQuery: "example.com", rawJson: null, createdAt: ago(0),
  },
  {
    id: "demo-2", timestamp: ago(2), srcIp: "10.8.0.2", dstIp: "93.184.216.34",
    srcPort: 45678, dstPort: 443, protocol: "TLS", bytes: 4096,
    direction: "outbound", hostName: null, tlsSni: "example.com",
    dnsQuery: null, rawJson: null, createdAt: ago(2),
  },
  {
    id: "demo-3", timestamp: ago(5), srcIp: "10.8.0.2", dstIp: "8.8.8.8",
    srcPort: 60001, dstPort: 53, protocol: "DNS", bytes: 64,
    direction: "outbound", hostName: null, tlsSni: null,
    dnsQuery: "github.com", rawJson: null, createdAt: ago(5),
  },
  {
    id: "demo-4", timestamp: ago(6), srcIp: "10.8.0.2", dstIp: "140.82.121.4",
    srcPort: 51234, dstPort: 443, protocol: "TLS", bytes: 8192,
    direction: "outbound", hostName: null, tlsSni: "github.com",
    dnsQuery: null, rawJson: null, createdAt: ago(6),
  },
  {
    id: "demo-5", timestamp: ago(10), srcIp: "140.82.121.4", dstIp: "10.8.0.2",
    srcPort: 443, dstPort: 51234, protocol: "TLS", bytes: 16384,
    direction: "inbound", hostName: null, tlsSni: null,
    dnsQuery: null, rawJson: null, createdAt: ago(10),
  },
  {
    id: "demo-6", timestamp: ago(15), srcIp: "10.8.0.2", dstIp: "142.250.196.110",
    srcPort: 52000, dstPort: 443, protocol: "HTTPS", bytes: 2048,
    direction: "outbound", hostName: null, tlsSni: "www.google.com",
    dnsQuery: null, rawJson: null, createdAt: ago(15),
  },
  {
    id: "demo-7", timestamp: ago(20), srcIp: "10.8.0.2", dstIp: "13.35.16.45",
    srcPort: 53100, dstPort: 80, protocol: "HTTP", bytes: 512,
    direction: "outbound", hostName: "example-cdn.net", tlsSni: null,
    dnsQuery: null, rawJson: null, createdAt: ago(20),
  },
  {
    id: "demo-8", timestamp: ago(30), srcIp: "10.8.0.2", dstIp: "1.1.1.1",
    srcPort: 54900, dstPort: 53, protocol: "DNS", bytes: 80,
    direction: "outbound", hostName: null, tlsSni: null,
    dnsQuery: "api.example.com", rawJson: null, createdAt: ago(30),
  },
  {
    id: "demo-9", timestamp: ago(35), srcIp: "10.8.0.2", dstIp: "104.26.10.50",
    srcPort: 44444, dstPort: 443, protocol: "TLS", bytes: 3200,
    direction: "outbound", hostName: null, tlsSni: "api.example.com",
    dnsQuery: null, rawJson: null, createdAt: ago(35),
  },
  {
    id: "demo-10", timestamp: ago(60), srcIp: "192.168.1.1", dstIp: "10.8.0.2",
    srcPort: null, dstPort: null, protocol: "ICMP", bytes: 64,
    direction: "inbound", hostName: null, tlsSni: null,
    dnsQuery: null, rawJson: null, createdAt: ago(60),
  },
  {
    id: "demo-11", timestamp: ago(90), srcIp: "10.8.0.2", dstIp: "8.8.4.4",
    srcPort: 55555, dstPort: 53, protocol: "DNS", bytes: 68,
    direction: "outbound", hostName: null, tlsSni: null,
    dnsQuery: "npm.pkg.github.com", rawJson: null, createdAt: ago(90),
  },
  {
    id: "demo-12", timestamp: ago(120), srcIp: "10.8.0.2", dstIp: "151.101.1.91",
    srcPort: 41000, dstPort: 443, protocol: "TLS", bytes: 12288,
    direction: "outbound", hostName: null, tlsSni: "pkg.github.com",
    dnsQuery: null, rawJson: null, createdAt: ago(120),
  },
  {
    id: "demo-13", timestamp: ago(180), srcIp: "10.8.0.2", dstIp: "52.84.0.10",
    srcPort: 42000, dstPort: 443, protocol: "HTTPS", bytes: 6144,
    direction: "outbound", hostName: null, tlsSni: "cdn.jsdelivr.net",
    dnsQuery: null, rawJson: null, createdAt: ago(180),
  },
  {
    id: "demo-14", timestamp: ago(240), srcIp: "10.8.0.100", dstIp: "10.8.0.2",
    srcPort: 51820, dstPort: 51820, protocol: "UDP", bytes: 148,
    direction: "inbound", hostName: null, tlsSni: null,
    dnsQuery: null, rawJson: null, createdAt: ago(240),
  },
  {
    id: "demo-15", timestamp: ago(300), srcIp: "10.8.0.2", dstIp: "172.217.25.14",
    srcPort: 43210, dstPort: 443, protocol: "TLS", bytes: 2560,
    direction: "outbound", hostName: null, tlsSni: "fonts.googleapis.com",
    dnsQuery: null, rawJson: null, createdAt: ago(300),
  },
];

export const SAMPLE_STATS: StatsResponse = {
  total: SAMPLE_PACKETS.length,
  protocols: ["DNS", "TLS", "HTTPS", "HTTP", "ICMP", "UDP"],
  latestTimestamp: SAMPLE_PACKETS[0].timestamp,
  demo: true,
};

/** サンプルデータをクエリパラメータに基づいてフィルタリング */
export function filterSamplePackets(params: {
  protocol?: string | null;
  srcIp?: string | null;
  dstIp?: string | null;
  dstPort?: string | null;
  timeFrom?: string | null;
  timeTo?: string | null;
  search?: string | null;
  page: number;
  pageSize: number;
}): { packets: Packet[]; total: number } {
  let filtered = SAMPLE_PACKETS.slice();

  if (params.protocol) {
    filtered = filtered.filter((p) => p.protocol === params.protocol);
  }
  if (params.srcIp) {
    filtered = filtered.filter((p) => p.srcIp.includes(params.srcIp!));
  }
  if (params.dstIp) {
    filtered = filtered.filter((p) => p.dstIp.includes(params.dstIp!));
  }
  if (params.dstPort) {
    filtered = filtered.filter((p) => p.dstPort === parseInt(params.dstPort!, 10));
  }
  if (params.timeFrom) {
    const from = new Date(params.timeFrom);
    filtered = filtered.filter((p) => new Date(p.timestamp) >= from);
  }
  if (params.timeTo) {
    const to = new Date(params.timeTo);
    filtered = filtered.filter((p) => new Date(p.timestamp) <= to);
  }
  if (params.search) {
    const s = params.search.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.srcIp.includes(s) ||
        p.dstIp.includes(s) ||
        p.hostName?.toLowerCase().includes(s) ||
        p.tlsSni?.toLowerCase().includes(s) ||
        p.dnsQuery?.toLowerCase().includes(s)
    );
  }

  const total = filtered.length;
  const start = (params.page - 1) * params.pageSize;
  const packets = filtered.slice(start, start + params.pageSize);

  return { packets, total };
}

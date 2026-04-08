import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("ERROR: DATABASE_URL が設定されていません。Supabase の接続文字列を .env に設定してください。");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SAMPLE: {
  timestamp: Date;
  srcIp: string;
  dstIp: string;
  srcPort: number | null;
  dstPort: number | null;
  protocol: string;
  bytes: number | null;
  direction: string;
  hostName: string | null;
  tlsSni: string | null;
  dnsQuery: string | null;
  rawJson: string | null;
}[] = [
  {
    timestamp: new Date("2026-04-08T10:00:00Z"),
    srcIp: "10.8.0.2", dstIp: "142.250.185.46",
    srcPort: 54321, dstPort: 443, protocol: "TLS", bytes: 4096,
    direction: "outbound", hostName: "google.com", tlsSni: "www.google.com",
    dnsQuery: null,
    rawJson: JSON.stringify({ frame: 1, tls_sni: "www.google.com" }),
  },
  {
    timestamp: new Date("2026-04-08T10:00:02Z"),
    srcIp: "142.250.185.46", dstIp: "10.8.0.2",
    srcPort: 443, dstPort: 54321, protocol: "TLS", bytes: 8192,
    direction: "inbound", hostName: "google.com", tlsSni: null, dnsQuery: null,
    rawJson: JSON.stringify({ frame: 2 }),
  },
  {
    timestamp: new Date("2026-04-08T10:00:05Z"),
    srcIp: "10.8.0.2", dstIp: "8.8.8.8",
    srcPort: 53421, dstPort: 53, protocol: "DNS", bytes: 72,
    direction: "outbound", hostName: null, tlsSni: null, dnsQuery: "api.github.com",
    rawJson: JSON.stringify({ frame: 3, dns_qry_name: "api.github.com" }),
  },
  {
    timestamp: new Date("2026-04-08T10:00:08Z"),
    srcIp: "10.8.0.2", dstIp: "140.82.114.6",
    srcPort: 49872, dstPort: 443, protocol: "TLS", bytes: 2048,
    direction: "outbound", hostName: "github.com", tlsSni: "api.github.com", dnsQuery: null,
    rawJson: JSON.stringify({ frame: 4, tls_sni: "api.github.com" }),
  },
  {
    timestamp: new Date("2026-04-08T10:00:20Z"),
    srcIp: "10.8.0.2", dstIp: "93.184.216.34",
    srcPort: 51000, dstPort: 80, protocol: "HTTP", bytes: 320,
    direction: "outbound", hostName: "example.com", tlsSni: null, dnsQuery: null,
    rawJson: JSON.stringify({ frame: 5, http_host: "example.com" }),
  },
  {
    timestamp: new Date("2026-04-08T10:01:00Z"),
    srcIp: "10.8.0.2", dstIp: "17.253.144.10",
    srcPort: 55001, dstPort: 443, protocol: "TLS", bytes: 16384,
    direction: "outbound", hostName: "apple.com", tlsSni: "mesu.apple.com", dnsQuery: null,
    rawJson: JSON.stringify({ frame: 6, tls_sni: "mesu.apple.com" }),
  },
  {
    timestamp: new Date("2026-04-08T10:01:10Z"),
    srcIp: "10.8.0.2", dstIp: "8.8.8.8",
    srcPort: 53422, dstPort: 53, protocol: "DNS", bytes: 68,
    direction: "outbound", hostName: null, tlsSni: null, dnsQuery: "www.youtube.com",
    rawJson: JSON.stringify({ frame: 7, dns_qry_name: "www.youtube.com" }),
  },
  {
    timestamp: new Date("2026-04-08T10:01:15Z"),
    srcIp: "10.8.0.2", dstIp: "172.217.26.78",
    srcPort: 55123, dstPort: 443, protocol: "TLS", bytes: 65536,
    direction: "outbound", hostName: "youtube.com", tlsSni: "www.youtube.com", dnsQuery: null,
    rawJson: JSON.stringify({ frame: 8, tls_sni: "www.youtube.com" }),
  },
  {
    timestamp: new Date("2026-04-08T10:02:00Z"),
    srcIp: "10.8.0.2", dstIp: "10.8.0.1",
    srcPort: null, dstPort: null, protocol: "ICMP", bytes: 64,
    direction: "outbound", hostName: null, tlsSni: null, dnsQuery: null,
    rawJson: JSON.stringify({ frame: 9, icmp_type: "echo-request" }),
  },
  {
    timestamp: new Date("2026-04-08T10:02:30Z"),
    srcIp: "10.8.0.2", dstIp: "104.18.2.161",
    srcPort: 56001, dstPort: 443, protocol: "TLS", bytes: 3000,
    direction: "outbound", hostName: "cloudflare.com", tlsSni: "cloudflare-dns.com", dnsQuery: null,
    rawJson: JSON.stringify({ frame: 10, tls_sni: "cloudflare-dns.com" }),
  },
  {
    timestamp: new Date("2026-04-08T10:03:00Z"),
    srcIp: "10.8.0.2", dstIp: "52.88.71.162",
    srcPort: 57000, dstPort: 443, protocol: "TLS", bytes: 1200,
    direction: "outbound", hostName: "amazon.com", tlsSni: "s3.amazonaws.com", dnsQuery: null,
    rawJson: JSON.stringify({ frame: 11, tls_sni: "s3.amazonaws.com" }),
  },
  {
    timestamp: new Date("2026-04-08T10:03:30Z"),
    srcIp: "10.8.0.2", dstIp: "8.8.8.8",
    srcPort: 53423, dstPort: 53, protocol: "DNS", bytes: 70,
    direction: "outbound", hostName: null, tlsSni: null, dnsQuery: "slack.com",
    rawJson: JSON.stringify({ frame: 12, dns_qry_name: "slack.com" }),
  },
  {
    timestamp: new Date("2026-04-08T10:04:00Z"),
    srcIp: "10.8.0.2", dstIp: "54.230.168.100",
    srcPort: 58000, dstPort: 443, protocol: "TLS", bytes: 4500,
    direction: "outbound", hostName: "slack.com", tlsSni: "slack.com", dnsQuery: null,
    rawJson: JSON.stringify({ frame: 13, tls_sni: "slack.com" }),
  },
];

async function main() {
  console.log("Seeding packets to Supabase…");
  await prisma.packet.deleteMany({});
  await prisma.packet.createMany({ data: SAMPLE });
  const count = await prisma.packet.count();
  console.log(`✓ Seeded ${count} packets`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

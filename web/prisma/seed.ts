import "dotenv/config";
import { PrismaClient, Prisma } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// seed は直接接続 (DIRECT_URL) が安定。PgBouncer Transaction Mode は
// deleteMany + createMany のトランザクションと相性が悪いため避ける。
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("ERROR: DIRECT_URL または DATABASE_URL が設定されていません。.env を確認してください。");
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
  rawJson: Prisma.InputJsonValue;
}[] = [
  // --- DNS クエリ ---
  {
    timestamp: new Date("2026-04-08T10:00:00Z"),
    srcIp: "10.8.0.2", dstIp: "8.8.8.8",
    srcPort: 53421, dstPort: 53, protocol: "DNS", bytes: 72,
    direction: "outbound", hostName: null, tlsSni: null,
    dnsQuery: "api.github.com",
    rawJson: { frame: 1, proto: "DNS", dns_qry_name: "api.github.com", dns_qry_type: "A" },
  },
  // --- TLS: github.com ---
  {
    timestamp: new Date("2026-04-08T10:00:08Z"),
    srcIp: "10.8.0.2", dstIp: "140.82.114.6",
    srcPort: 49872, dstPort: 443, protocol: "TLS", bytes: 2048,
    direction: "outbound", hostName: "github.com", tlsSni: "api.github.com",
    dnsQuery: null,
    rawJson: { frame: 2, proto: "TLS", tls_sni: "api.github.com", tls_version: "TLSv1.3" },
  },
  // --- TLS: google.com ---
  {
    timestamp: new Date("2026-04-08T10:00:30Z"),
    srcIp: "10.8.0.2", dstIp: "142.250.185.46",
    srcPort: 54321, dstPort: 443, protocol: "TLS", bytes: 4096,
    direction: "outbound", hostName: "google.com", tlsSni: "www.google.com",
    dnsQuery: null,
    rawJson: { frame: 3, proto: "TLS", tls_sni: "www.google.com", tls_version: "TLSv1.3" },
  },
  // --- TLS: google.com inbound response ---
  {
    timestamp: new Date("2026-04-08T10:00:32Z"),
    srcIp: "142.250.185.46", dstIp: "10.8.0.2",
    srcPort: 443, dstPort: 54321, protocol: "TLS", bytes: 8192,
    direction: "inbound", hostName: "google.com", tlsSni: null,
    dnsQuery: null,
    rawJson: { frame: 4, proto: "TLS" },
  },
  // --- HTTP: example.com ---
  {
    timestamp: new Date("2026-04-08T10:00:50Z"),
    srcIp: "10.8.0.2", dstIp: "93.184.216.34",
    srcPort: 51000, dstPort: 80, protocol: "HTTP", bytes: 320,
    direction: "outbound", hostName: "example.com", tlsSni: null,
    dnsQuery: null,
    rawJson: { frame: 5, proto: "HTTP", http_method: "GET", http_host: "example.com", http_uri: "/" },
  },
  // --- DNS: youtube.com ---
  {
    timestamp: new Date("2026-04-08T10:01:10Z"),
    srcIp: "10.8.0.2", dstIp: "8.8.8.8",
    srcPort: 53422, dstPort: 53, protocol: "DNS", bytes: 68,
    direction: "outbound", hostName: null, tlsSni: null,
    dnsQuery: "www.youtube.com",
    rawJson: { frame: 6, proto: "DNS", dns_qry_name: "www.youtube.com", dns_qry_type: "AAAA" },
  },
  // --- TLS: youtube.com ---
  {
    timestamp: new Date("2026-04-08T10:01:15Z"),
    srcIp: "10.8.0.2", dstIp: "172.217.26.78",
    srcPort: 55123, dstPort: 443, protocol: "TLS", bytes: 65536,
    direction: "outbound", hostName: "youtube.com", tlsSni: "www.youtube.com",
    dnsQuery: null,
    rawJson: { frame: 7, proto: "TLS", tls_sni: "www.youtube.com", tls_version: "TLSv1.3" },
  },
  // --- TLS: Apple (mesu) ---
  {
    timestamp: new Date("2026-04-08T10:01:45Z"),
    srcIp: "10.8.0.2", dstIp: "17.253.144.10",
    srcPort: 55001, dstPort: 443, protocol: "TLS", bytes: 16384,
    direction: "outbound", hostName: "apple.com", tlsSni: "mesu.apple.com",
    dnsQuery: null,
    rawJson: { frame: 8, proto: "TLS", tls_sni: "mesu.apple.com", tls_version: "TLSv1.3" },
  },
  // --- ICMP: ping ---
  {
    timestamp: new Date("2026-04-08T10:02:00Z"),
    srcIp: "10.8.0.2", dstIp: "10.8.0.1",
    srcPort: null, dstPort: null, protocol: "ICMP", bytes: 64,
    direction: "outbound", hostName: null, tlsSni: null,
    dnsQuery: null,
    rawJson: { frame: 9, proto: "ICMP", icmp_type: "echo-request", icmp_seq: 1 },
  },
  // --- TLS: Cloudflare ---
  {
    timestamp: new Date("2026-04-08T10:02:30Z"),
    srcIp: "10.8.0.2", dstIp: "104.18.2.161",
    srcPort: 56001, dstPort: 443, protocol: "TLS", bytes: 3000,
    direction: "outbound", hostName: "cloudflare.com", tlsSni: "cloudflare-dns.com",
    dnsQuery: null,
    rawJson: { frame: 10, proto: "TLS", tls_sni: "cloudflare-dns.com", tls_version: "TLSv1.3" },
  },
  // --- DNS: slack.com ---
  {
    timestamp: new Date("2026-04-08T10:03:00Z"),
    srcIp: "10.8.0.2", dstIp: "8.8.8.8",
    srcPort: 53423, dstPort: 53, protocol: "DNS", bytes: 70,
    direction: "outbound", hostName: null, tlsSni: null,
    dnsQuery: "slack.com",
    rawJson: { frame: 11, proto: "DNS", dns_qry_name: "slack.com", dns_qry_type: "A" },
  },
  // --- TLS: Slack ---
  {
    timestamp: new Date("2026-04-08T10:03:30Z"),
    srcIp: "10.8.0.2", dstIp: "54.230.168.100",
    srcPort: 58000, dstPort: 443, protocol: "TLS", bytes: 4500,
    direction: "outbound", hostName: "slack.com", tlsSni: "slack.com",
    dnsQuery: null,
    rawJson: { frame: 12, proto: "TLS", tls_sni: "slack.com", tls_version: "TLSv1.3" },
  },
  // --- TLS: AWS S3 ---
  {
    timestamp: new Date("2026-04-08T10:04:00Z"),
    srcIp: "10.8.0.2", dstIp: "52.88.71.162",
    srcPort: 57000, dstPort: 443, protocol: "TLS", bytes: 1200,
    direction: "outbound", hostName: "amazon.com", tlsSni: "s3.amazonaws.com",
    dnsQuery: null,
    rawJson: { frame: 13, proto: "TLS", tls_sni: "s3.amazonaws.com", tls_version: "TLSv1.3" },
  },
  // --- UDP: WireGuard ---
  {
    timestamp: new Date("2026-04-08T10:04:30Z"),
    srcIp: "10.8.0.100", dstIp: "10.8.0.2",
    srcPort: 51820, dstPort: 51820, protocol: "UDP", bytes: 148,
    direction: "inbound", hostName: null, tlsSni: null,
    dnsQuery: null,
    rawJson: { frame: 14, proto: "UDP", note: "WireGuard handshake" },
  },
  // --- HTTPS: CDN ---
  {
    timestamp: new Date("2026-04-08T10:05:00Z"),
    srcIp: "10.8.0.2", dstIp: "52.84.0.10",
    srcPort: 42000, dstPort: 443, protocol: "HTTPS", bytes: 6144,
    direction: "outbound", hostName: null, tlsSni: "cdn.jsdelivr.net",
    dnsQuery: null,
    rawJson: { frame: 15, proto: "HTTPS", tls_sni: "cdn.jsdelivr.net" },
  },
];

async function main() {
  console.log("Seeding packets to Supabase…");
  await prisma.packet.deleteMany({});
  await prisma.packet.createMany({ data: SAMPLE });
  const count = await prisma.packet.count();
  console.log(`✓ Seeded ${count} packets`);
  console.log("");
  console.log("確認できる画面:");
  console.log("  / または /packets  … 一覧 (15件, 各種プロトコル)");
  console.log("  /packets?protocol=DNS … DNS のみフィルタ");
  console.log("  /packets?protocol=TLS … TLS のみフィルタ");
  console.log("  Stats カード … total=15, protocols に DNS/TLS/HTTP/HTTPS/ICMP/UDP が表示");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

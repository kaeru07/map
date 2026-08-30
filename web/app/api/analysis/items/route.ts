import { isDemoMode, prisma } from "@/lib/db";
import { SAMPLE_PACKETS } from "@/lib/sample-data";
import { InfoItem, ItemsData } from "@/lib/types";

// ─── デモ用: JS で集計 ────────────────────────────────────────────────────────

function countBy(
  pairs: (string | null | undefined)[]
): InfoItem[] {
  const map = new Map<string, number>();
  for (const v of pairs) {
    if (v) map.set(v, (map.get(v) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, count }));
}

function computeFromPackets(
  packets: typeof SAMPLE_PACKETS
): Omit<ItemsData, "generatedAt" | "demo"> {
  // domains = hostName (= tlsSni || httpHost || dnsQuery の優先)
  const domainMap = new Map<string, number>();
  for (const p of packets) {
    const d = p.tlsSni || p.dnsQuery || p.hostName;
    if (d) domainMap.set(d, (domainMap.get(d) ?? 0) + 1);
  }
  const domains = [...domainMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, count }));

  return {
    domains,
    snIs:       countBy(packets.map((p) => p.tlsSni)),
    dnsQueries: countBy(packets.map((p) => p.dnsQuery)),
    dstIPs:     countBy(packets.map((p) => p.dstIp)),
    protocols:  countBy(packets.map((p) => p.protocol)),
    dstPorts:   countBy(packets.map((p) => p.dstPort != null ? String(p.dstPort) : null)),
  };
}

// ─── Route Handler ────────────────────────────────────────────────────────────

const TAKE = 200; // 上位 200 件まで返す

export async function GET() {
  const generatedAt = new Date().toISOString();

  if (isDemoMode()) {
    return Response.json({
      ...computeFromPackets(SAMPLE_PACKETS),
      generatedAt,
      demo: true,
    } satisfies ItemsData);
  }

  try {
    const [hostNames, tlsSnIs, dnsQs, dstIps, protocols, dstPorts] =
      await Promise.all([
        // ドメイン (hostName = tlsSni || httpHost || dnsQuery)
        prisma.packet.groupBy({
          by: ["hostName"],
          _count: { hostName: true },
          where: { hostName: { not: null } },
          orderBy: { _count: { hostName: "desc" } },
          take: TAKE,
        }),
        // SNI のみ
        prisma.packet.groupBy({
          by: ["tlsSni"],
          _count: { tlsSni: true },
          where: { tlsSni: { not: null } },
          orderBy: { _count: { tlsSni: "desc" } },
          take: TAKE,
        }),
        // DNS クエリのみ
        prisma.packet.groupBy({
          by: ["dnsQuery"],
          _count: { dnsQuery: true },
          where: { dnsQuery: { not: null } },
          orderBy: { _count: { dnsQuery: "desc" } },
          take: TAKE,
        }),
        // 宛先 IP
        prisma.packet.groupBy({
          by: ["dstIp"],
          _count: { dstIp: true },
          orderBy: { _count: { dstIp: "desc" } },
          take: TAKE,
        }),
        // プロトコル
        prisma.packet.groupBy({
          by: ["protocol"],
          _count: { protocol: true },
          orderBy: { _count: { protocol: "desc" } },
        }),
        // 宛先ポート
        prisma.packet.groupBy({
          by: ["dstPort"],
          _count: { dstPort: true },
          where: { dstPort: { not: null } },
          orderBy: { _count: { dstPort: "desc" } },
          take: 100,
        }),
      ]);

    return Response.json({
      generatedAt,
      domains:    hostNames.map((r) => ({ value: r.hostName!,          count: r._count.hostName })),
      snIs:       tlsSnIs.map((r)  => ({ value: r.tlsSni!,            count: r._count.tlsSni   })),
      dnsQueries: dnsQs.map((r)    => ({ value: r.dnsQuery!,          count: r._count.dnsQuery  })),
      dstIPs:     dstIps.map((r)   => ({ value: r.dstIp,              count: r._count.dstIp     })),
      protocols:  protocols.map((r)=> ({ value: r.protocol,           count: r._count.protocol  })),
      dstPorts:   dstPorts.map((r) => ({ value: String(r.dstPort!),   count: r._count.dstPort   })),
    } satisfies ItemsData);
  } catch {
    return Response.json({
      ...computeFromPackets(SAMPLE_PACKETS),
      generatedAt,
      demo: true,
    } satisfies ItemsData);
  }
}

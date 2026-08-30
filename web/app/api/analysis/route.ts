import { NextRequest } from "next/server";
import { isDemoMode, prisma } from "@/lib/db";
import { SAMPLE_PACKETS } from "@/lib/sample-data";
import { ComprehensiveAnalysis, PacketFilters } from "@/lib/types";
import { Prisma } from "@/app/generated/prisma/client";

// ─── フィルター → Prisma where 変換 ─────────────────────────────────────────

function buildWhere(f: PacketFilters): Prisma.PacketWhereInput {
  const where: Prisma.PacketWhereInput = {};
  if (f.protocol) where.protocol = f.protocol;
  if (f.srcIp)    where.srcIp    = { contains: f.srcIp };
  if (f.dstIp)    where.dstIp    = { contains: f.dstIp };
  if (f.dstPort)  where.dstPort  = parseInt(f.dstPort, 10);
  if (f.timeFrom || f.timeTo) {
    where.timestamp = {};
    if (f.timeFrom) where.timestamp.gte = new Date(f.timeFrom);
    if (f.timeTo)   where.timestamp.lte = new Date(f.timeTo);
  }
  if (f.search) {
    where.OR = [
      { srcIp:    { contains: f.search } },
      { dstIp:    { contains: f.search } },
      { hostName: { contains: f.search } },
      { tlsSni:   { contains: f.search } },
      { dnsQuery: { contains: f.search } },
      { dnsResp:  { contains: f.search } },
      { httpPath: { contains: f.search } },
    ];
  }
  return where;
}

// ─── デモモード用: JS で集計 ──────────────────────────────────────────────────

function countBy(pairs: (string | null | undefined)[]): { value: string; count: number }[] {
  const map = new Map<string, number>();
  for (const v of pairs) {
    if (v) map.set(v, (map.get(v) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
}

type PacketLike = typeof SAMPLE_PACKETS[number];

function applyFilters(packets: typeof SAMPLE_PACKETS, f: PacketFilters): typeof SAMPLE_PACKETS {
  return packets.filter((p) => {
    if (f.protocol && p.protocol !== f.protocol) return false;
    if (f.srcIp    && !p.srcIp.includes(f.srcIp)) return false;
    if (f.dstIp    && !p.dstIp.includes(f.dstIp)) return false;
    if (f.dstPort  && p.dstPort !== parseInt(f.dstPort, 10)) return false;
    if (f.timeFrom && new Date(p.timestamp) < new Date(f.timeFrom)) return false;
    if (f.timeTo   && new Date(p.timestamp) > new Date(f.timeTo))   return false;
    if (f.search) {
      const s = f.search.toLowerCase();
      const matches =
        p.srcIp.toLowerCase().includes(s) ||
        p.dstIp.toLowerCase().includes(s) ||
        (p.hostName  ?? "").toLowerCase().includes(s) ||
        (p.tlsSni    ?? "").toLowerCase().includes(s) ||
        (p.dnsQuery  ?? "").toLowerCase().includes(s);
      if (!matches) return false;
    }
    return true;
  });
}

function computeFromPackets(
  packets: typeof SAMPLE_PACKETS,
  filters: PacketFilters
): Omit<ComprehensiveAnalysis, "generatedAt" | "demo" | "filters"> {
  const total = packets.length;

  const ipSet = new Set<string>();
  const domainCount = new Map<string, number>();
  const protoCount  = new Map<string, number>();
  const recentDomains: string[] = [];
  const seenDomains  = new Set<string>();

  for (const p of packets) {
    ipSet.add(p.srcIp);
    ipSet.add(p.dstIp);
    const d = p.tlsSni || p.dnsQuery || p.hostName;
    if (d) {
      domainCount.set(d, (domainCount.get(d) ?? 0) + 1);
      if (!seenDomains.has(d) && recentDomains.length < 10) {
        seenDomains.add(d);
        recentDomains.push(d);
      }
    }
    protoCount.set(p.protocol, (protoCount.get(p.protocol) ?? 0) + 1);
  }

  const topDomains = [...domainCount.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([domain, count]) => ({ domain, count }));

  const protocols = [...protoCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([protocol, count]) => ({ protocol, count }));

  const isVpn    = (ip: string) => ip.startsWith("10.") && ip !== "10.0.0.1";
  const isIphone = (ip: string) => ip === "10.0.0.2" || ip === "10.8.0.2";

  // ドメイン → hostName 優先 (items用)
  const domainItems: { value: string; count: number }[] = topDomains.map((x) => ({ value: x.domain, count: x.count }));

  return {
    summary: { total, uniqueIPs: ipSet.size, uniqueDomains: domainCount.size },
    topDomains,
    protocols,
    vpn: {
      vpnPackets:    packets.filter((p) => isVpn(p.srcIp) || isVpn(p.dstIp)).length,
      iPhonePackets: packets.filter((p) => isIphone(p.srcIp) || isIphone(p.dstIp)).length,
    },
    recentDomains,
    items: {
      domains:               domainItems,
      snIs:                  countBy(packets.map((p) => p.tlsSni)),
      dnsQueries:            countBy(packets.map((p) => p.dnsQuery)),
      dstIPs:                countBy(packets.map((p) => p.dstIp)),
      protocols:             countBy(packets.map((p) => p.protocol)),
      dstPorts:              countBy(packets.map((p) => p.dstPort != null ? String(p.dstPort) : null)),
      serviceCategories:     [],
      representativeDomains: [],
    },
  };
}

// ─── Route Handler ────────────────────────────────────────────────────────────

const TAKE = 200;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const generatedAt = new Date().toISOString();

  const filters: PacketFilters = {
    protocol: searchParams.get("protocol") ?? undefined,
    srcIp:    searchParams.get("srcIp")    ?? undefined,
    dstIp:    searchParams.get("dstIp")    ?? undefined,
    dstPort:  searchParams.get("dstPort")  ?? undefined,
    timeFrom: searchParams.get("timeFrom") ?? undefined,
    timeTo:   searchParams.get("timeTo")   ?? undefined,
    search:   searchParams.get("search")   ?? undefined,
  };
  // undefined を持つキーを除去
  for (const k of Object.keys(filters) as (keyof PacketFilters)[]) {
    if (filters[k] === undefined) delete filters[k];
  }

  if (isDemoMode()) {
    const filtered = applyFilters(SAMPLE_PACKETS, filters);
    return Response.json({
      ...computeFromPackets(filtered, filters),
      generatedAt,
      filters,
      demo: true,
    } satisfies ComprehensiveAnalysis);
  }

  try {
    const where = buildWhere(filters);

    // 集計クエリを並列実行
    const [
      total,
      protocolGroups,
      vpnCount,
      iPhoneCount,
      recentRows,
      // Items
      hostNames,
      tlsSnIs,
      dnsQs,
      dstIps,
      dstPorts,
    ] = await Promise.all([
      prisma.packet.count({ where }),
      prisma.packet.groupBy({
        by: ["protocol"],
        _count: { id: true },
        where,
        orderBy: { _count: { id: "desc" } },
      }),
      prisma.packet.count({
        where: { AND: [where, { OR: [
          { srcIp: { startsWith: "10.0.0." } },
          { dstIp: { startsWith: "10.0.0." } },
        ]}] },
      }),
      prisma.packet.count({
        where: { AND: [where, { OR: [{ srcIp: "10.0.0.2" }, { dstIp: "10.0.0.2" }] }] },
      }),
      prisma.packet.findMany({
        select: { srcIp: true, dstIp: true, tlsSni: true, dnsQuery: true, hostName: true },
        where,
        orderBy: { timestamp: "desc" },
        take: 500,
      }),
      // items
      prisma.packet.groupBy({
        by: ["hostName"],
        _count: { hostName: true },
        where: { AND: [where, { hostName: { not: null } }] },
        orderBy: { _count: { hostName: "desc" } },
        take: TAKE,
      }),
      prisma.packet.groupBy({
        by: ["tlsSni"],
        _count: { tlsSni: true },
        where: { AND: [where, { tlsSni: { not: null } }] },
        orderBy: { _count: { tlsSni: "desc" } },
        take: TAKE,
      }),
      prisma.packet.groupBy({
        by: ["dnsQuery"],
        _count: { dnsQuery: true },
        where: { AND: [where, { dnsQuery: { not: null } }] },
        orderBy: { _count: { dnsQuery: "desc" } },
        take: TAKE,
      }),
      prisma.packet.groupBy({
        by: ["dstIp"],
        _count: { dstIp: true },
        where,
        orderBy: { _count: { dstIp: "desc" } },
        take: TAKE,
      }),
      prisma.packet.groupBy({
        by: ["dstPort"],
        _count: { dstPort: true },
        where: { AND: [where, { dstPort: { not: null } }] },
        orderBy: { _count: { dstPort: "desc" } },
        take: 100,
      }),
    ]);

    // ユニーク IP / ドメイン (直近 500 件ベース)
    const ipSet = new Set<string>();
    const domainCount = new Map<string, number>();
    const recentDomains: string[] = [];
    const seenDomains = new Set<string>();

    for (const p of recentRows) {
      ipSet.add(p.srcIp);
      ipSet.add(p.dstIp);
      const d = p.tlsSni || p.dnsQuery || p.hostName;
      if (d) {
        domainCount.set(d, (domainCount.get(d) ?? 0) + 1);
        if (!seenDomains.has(d) && recentDomains.length < 10) {
          seenDomains.add(d);
          recentDomains.push(d);
        }
      }
    }

    const topDomains = [...domainCount.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([domain, count]) => ({ domain, count }));

    return Response.json({
      generatedAt,
      filters,
      summary: { total, uniqueIPs: ipSet.size, uniqueDomains: domainCount.size },
      topDomains,
      protocols: protocolGroups.map((g) => ({ protocol: g.protocol, count: g._count.id })),
      vpn: { iPhonePackets: iPhoneCount, vpnPackets: vpnCount },
      recentDomains,
      items: {
        domains:               hostNames.map((r) => ({ value: r.hostName!,        count: r._count.hostName })),
        snIs:                  tlsSnIs.map((r)   => ({ value: r.tlsSni!,          count: r._count.tlsSni   })),
        dnsQueries:            dnsQs.map((r)     => ({ value: r.dnsQuery!,        count: r._count.dnsQuery  })),
        dstIPs:                dstIps.map((r)    => ({ value: r.dstIp,            count: r._count.dstIp     })),
        protocols:             protocolGroups.map((g) => ({ value: g.protocol,    count: g._count.id        })),
        dstPorts:              dstPorts.map((r)  => ({ value: String(r.dstPort!), count: r._count.dstPort   })),
        serviceCategories:     [],
        representativeDomains: [],
      },
    } satisfies ComprehensiveAnalysis);
  } catch {
    const filtered = applyFilters(SAMPLE_PACKETS, filters);
    return Response.json({
      ...computeFromPackets(filtered, filters),
      generatedAt,
      filters,
      demo: true,
    } satisfies ComprehensiveAnalysis);
  }
}

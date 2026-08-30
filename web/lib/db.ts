import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// ─── モード判定 ───────────────────────────────────────────────────────────────

export function isDemoMode(): boolean {
  return !process.env.DIRECT_URL && !process.env.DATABASE_URL;
}

// ─── 接続文字列解決 ───────────────────────────────────────────────────────────

function resolveConnectionString(): string {
  const direct = process.env.DIRECT_URL;
  if (direct) return direct;

  const db = process.env.DATABASE_URL;
  if (!db) return "postgresql://localhost:5432/netscope_placeholder";

  return db
    .replace(/[?&]pgbouncer=[^&]*/g, "")
    .replace(/[?&]connection_limit=[^&]*/g, "")
    .replace(/\?$/, "")
    .replace(/&$/, "");
}

// ─── 起動時診断ログ ───────────────────────────────────────────────────────────

function logStartup() {
  const hasDirect = !!process.env.DIRECT_URL;
  const hasDb     = !!process.env.DATABASE_URL;
  const mode      = (!hasDirect && !hasDb) ? "DEMO (env vars missing)" : "LIVE (env vars OK)";
  console.log(
    `[NetScope/DB] mode=${mode} ` +
    `DIRECT_URL=${hasDirect ? "✓" : "✗"} ` +
    `DATABASE_URL=${hasDb ? "✓" : "✗"}`
  );
  if (!hasDirect && !hasDb) {
    console.warn("[NetScope/DB] Neither DIRECT_URL nor DATABASE_URL is set → falling back to sample data");
  }
}

// ─── Prisma 初期化 ────────────────────────────────────────────────────────────

function createPrisma(): PrismaClient {
  const connectionString = resolveConnectionString();
  const pool    = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// 初回ロード時に診断ログを出力
logStartup();

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

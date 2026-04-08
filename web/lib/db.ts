import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

/**
 * DATABASE_URL が未設定のときは demo mode。
 * - API routes は isDemoMode() を確認してから prisma を呼ぶこと
 * - demo mode では sample-data.ts のデータを返す
 */
export function isDemoMode(): boolean {
  return !process.env.DATABASE_URL;
}

function createPrisma(): PrismaClient {
  // isDemoMode() = true のとき prisma は呼ばれない。
  // URL が未設定でも Pool 生成は安全（接続は query 時にのみ発生）。
  const connectionString =
    process.env.DATABASE_URL ?? "postgresql://localhost:5432/netscope_placeholder";
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

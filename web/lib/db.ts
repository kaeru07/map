import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

function getDbUrl(): string {
  const raw = process.env.DATABASE_URL ?? "";
  if (!raw) return "";
  if (raw.startsWith("file:./")) {
    const rel = raw.replace("file:./", "");
    return `file:${path.resolve(process.cwd(), rel)}`;
  }
  return raw;
}

/**
 * DBへの接続が期待できない環境かどうか。
 * - DATABASE_URL 未設定
 * - Vercel上でローカルファイルURL (file:...) を参照している場合
 */
export function isDemoMode(): boolean {
  const url = getDbUrl();
  if (!url) return true;
  if (process.env.VERCEL && url.startsWith("file:")) return true;
  return false;
}

function createPrisma() {
  const url = getDbUrl() || "file::memory:";
  const adapter = new PrismaLibSql({ url });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

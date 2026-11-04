import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";

// SQLite paths are relative to the repo root (the process working directory).
export const DATABASE_URL = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

function createClient() {
  const adapter = new PrismaBetterSqlite3({ url: DATABASE_URL });
  return new PrismaClient({ adapter, log: [{ emit: "event", level: "query" }] });
}

type Client = ReturnType<typeof createClient>;
const globalForPrisma = globalThis as unknown as { prisma?: Client };

export const prisma: Client = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type Tx = Prisma.TransactionClient;

import { PrismaClient, type Prisma } from "@prisma/client";

function createClient() {
  return new PrismaClient({ log: [{ emit: "event", level: "query" }] });
}

type Client = ReturnType<typeof createClient>;
const globalForPrisma = globalThis as unknown as { prisma?: Client };

export const prisma: Client = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type Tx = Prisma.TransactionClient;

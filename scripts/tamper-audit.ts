// Demo helper: edits one audit row directly in the database, bypassing the
// app, to show that /api/audit/verify detects it.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const target = await prisma.auditEntry.findFirst({ where: { action: "case.approve" }, orderBy: { id: "desc" } })
    ?? await prisma.auditEntry.findFirst({ orderBy: { id: "desc" } });
  if (!target) return console.log("No audit entries yet.");
  await prisma.$executeRaw`UPDATE AuditEntry SET actorId = 'u-mallory' WHERE id = ${target.id}`;
  console.log(`Changed actorId on audit entry #${target.id} (${target.action}) from ${target.actorId} to u-mallory.`);
}

main().finally(() => prisma.$disconnect());

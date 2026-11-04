import { PrismaClient } from "@prisma/client";
import { resetAndSeed } from "./seed-lib";

const prisma = new PrismaClient();
resetAndSeed(prisma)
  .then((n) => console.log(`Seeded ${n} synthetic cases (audit log reset).`))
  .finally(() => prisma.$disconnect());

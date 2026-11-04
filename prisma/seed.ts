import { prisma } from "../src/core/db";
import { resetAndSeed } from "./seed-lib";

const t0 = performance.now();
resetAndSeed(prisma)
  .then((n) => console.log(`Seeded ${n.toLocaleString()} synthetic cases and 4 users; audit log cleared (${((performance.now() - t0) / 1000).toFixed(1)} s).`))
  .finally(() => prisma.$disconnect());

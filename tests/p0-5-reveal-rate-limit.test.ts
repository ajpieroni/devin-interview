import { beforeEach, describe, expect, it } from "vitest";
import { POST as reveal } from "@/app/api/cases/[id]/reveal/route";
import { REVEAL_RATE_LIMIT } from "@/config/policy";
import { prisma } from "@/core/db";
import { resetRateLimits } from "@/core/rate-limit";
import { call, makeCase, resetDb, type UserKey } from "./helpers";

describe("P0-5 audit log: reveal rate limit", () => {
  beforeEach(async () => {
    await resetDb();
    resetRateLimits();
  });

  const revealAs = (id: string, as: UserKey) =>
    call(reveal, { method: "POST", path: `/api/cases/${id}/reveal`, as, params: { id }, body: { field: "governmentId" } });

  it("refuses reveals over the limit with 429 and audits the refusal", async () => {
    const c = await makeCase({ type: "kyc", sensitive: JSON.stringify({ governmentId: "ID-000000001" }) });
    for (let i = 0; i < REVEAL_RATE_LIMIT.max; i++) expect((await revealAs(c.id, "riley")).status).toBe(200);
    const res = await revealAs(c.id, "riley");
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(res.body.error).toMatch(/Too many reveals/);
    const refused = await prisma.auditEntry.findMany({ where: { action: "field.reveal.rate_limited" } });
    expect(refused).toHaveLength(1);
    expect(refused[0].actorId).toBe("u-riley");
    expect(refused[0].after).not.toContain("ID-000000001");
  });

  it("counts each user separately", async () => {
    const c = await makeCase({ type: "kyc", sensitive: JSON.stringify({ governmentId: "ID-000000002" }) });
    for (let i = 0; i <= REVEAL_RATE_LIMIT.max; i++) await revealAs(c.id, "riley");
    expect((await revealAs(c.id, "adam")).status).toBe(200);
  });
});

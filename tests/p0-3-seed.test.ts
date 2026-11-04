import { afterAll, describe, expect, it } from "vitest";
import { REVIEW_TARGET_DAYS } from "@/config/approval-rules";
import { prisma } from "@/core/db";
import { BOUNDARY_REFUND_CENTS, MAX_AGE_DAYS, generateSeed, resetAndSeed } from "../prisma/seed-lib";

const DAY_MS = 86_400_000;
const OPEN = ["pending", "awaiting_second_approval", "escalated"];

describe("P0-3 work queue: repeatable demo seed", () => {
  const now = new Date("2026-01-15T12:00:00Z");
  const { cases, approvals } = generateSeed({ now });
  const age = (d: Date) => Math.floor((now.getTime() - d.getTime()) / DAY_MS);

  afterAll(async () => {
    await prisma.approval.deleteMany();
    await prisma.case.deleteMany();
  });

  it("has 10,000 cases aged 0 to 30 days with every risk tier", () => {
    expect(cases).toHaveLength(10_000);
    const ages = cases.map((c) => age(c.createdAt));
    expect(Math.min(...ages)).toBe(0);
    expect(Math.max(...ages)).toBe(MAX_AGE_DAYS);
    expect(new Set(cases.map((c) => c.risk))).toEqual(new Set(["low", "medium", "high"]));
  });

  it("has some, but not all, open cases past their review target", () => {
    const open = cases.filter((c) => OPEN.includes(c.status));
    const overdue = open.filter((c) => age(c.createdAt) > REVIEW_TARGET_DAYS[c.type]);
    expect(overdue.length).toBeGreaterThan(0);
    expect(overdue.length).toBeLessThan(open.length / 2);
  });

  it("includes pending refunds at exactly $4,999, $5,000 and $5,001", () => {
    expect(BOUNDARY_REFUND_CENTS).toEqual([499_900, 500_000, 500_100]);
    for (const cents of BOUNDARY_REFUND_CENTS) {
      expect(cases.some((c) => c.type === "refund" && c.status === "pending" && c.amountCents === cents)).toBe(true);
    }
  });

  it("includes a KYC case in every status", () => {
    for (const s of ["pending", "awaiting_second_approval", "approved", "rejected", "escalated"]) {
      expect(cases.some((c) => c.type === "kyc" && c.status === s), s).toBe(true);
    }
  });

  it("gives each case awaiting a second approval one first approval from someone other than the requester", () => {
    const awaiting = cases.filter((c) => c.status === "awaiting_second_approval");
    expect(awaiting.length).toBeGreaterThan(0);
    for (const c of awaiting) {
      const a = approvals.filter((x) => x.caseId === c.id);
      expect(a).toHaveLength(1);
      expect(a[0].userId).not.toBe(c.requesterId);
    }
  });

  it("is deterministic", () => {
    const again = generateSeed({ now }).cases;
    expect(again.map((c) => [c.id, c.status, c.amountCents])).toEqual(cases.map((c) => [c.id, c.status, c.amountCents]));
  });

  it("resets to seed state, with 4 users, in under 10 seconds", async () => {
    const t0 = performance.now();
    await resetAndSeed(prisma);
    expect(performance.now() - t0).toBeLessThan(10_000);
    expect(await prisma.case.count()).toBe(10_000);
    expect(await prisma.auditEntry.count()).toBe(0);
    expect((await prisma.user.findMany({ orderBy: { id: "asc" } })).map((u) => [u.id, u.roles])).toEqual([
      ["u-adam", "admin"],
      ["u-avery", "approver"],
      ["u-riley", "reviewer"],
      ["u-vera", "viewer"],
    ]);
  }, 15_000);
});

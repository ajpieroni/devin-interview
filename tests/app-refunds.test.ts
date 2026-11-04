import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { oldestPendingRefunds, REFUND_LIMIT_CENTS, refundQuery, refundSummary } from "@/apps/refunds";
import { listCases } from "@/core/cases";
import { prisma } from "@/core/db";
import { resetAndSeed } from "../prisma/seed-lib";

describe("Refunds dashboard app (on P0-3 queue, P0-4 limits)", () => {
  beforeAll(async () => {
    await resetAndSeed(prisma);
  });
  afterAll(async () => {
    await prisma.approval.deleteMany();
    await prisma.case.deleteMany();
  });

  it("reads the single-approver limit from the one config file", () => {
    expect(REFUND_LIMIT_CENTS).toBe(500_000);
  });

  it("counts and totals refunds by status, matching the database", async () => {
    const summary = await refundSummary();
    const all = await prisma.case.aggregate({ where: { type: "refund" }, _count: { _all: true }, _sum: { amountCents: true } });
    expect(summary.reduce((n, s) => n + s.count, 0)).toBe(all._count._all);
    expect(summary.reduce((n, s) => n + s.totalCents, 0)).toBe(all._sum.amountCents);
    expect(summary.map((s) => s.status)).toEqual(["pending", "awaiting_second_approval", "approved", "rejected", "escalated"]);
  });

  it("lists the oldest pending refunds first", async () => {
    const oldest = await oldestPendingRefunds(5);
    expect(oldest).toHaveLength(5);
    for (const c of oldest) {
      expect(c.type).toBe("refund");
      expect(["pending", "awaiting_second_approval"]).toContain(c.status);
    }
    for (let i = 1; i < oldest.length; i++) expect(oldest[i].createdAt >= oldest[i - 1].createdAt).toBe(true);
  });

  it("only ever lists refunds, and sorts by amount on request", async () => {
    expect(refundQuery(new URLSearchParams("type=kyc")).type).toBe("refund");
    const { items } = await listCases(refundQuery(new URLSearchParams("view=largest&pageSize=10")));
    expect(items.every((c) => c.type === "refund")).toBe(true);
    for (let i = 1; i < items.length; i++) expect(items[i].amountCents <= items[i - 1].amountCents).toBe(true);
    expect(items[0].requiredApprovals).toBe(2);
  });
});

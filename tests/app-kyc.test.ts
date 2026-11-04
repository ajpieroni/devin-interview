import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ageVsTarget, KYC_TARGET_DAYS, kycQuery } from "@/apps/kyc";
import { listCases } from "@/core/cases";
import { prisma } from "@/core/db";
import { resetAndSeed } from "../prisma/seed-lib";

describe("KYC review queue app (on P0-3 queue)", () => {
  beforeAll(async () => {
    await resetAndSeed(prisma);
  });
  afterAll(async () => {
    await prisma.approval.deleteMany();
    await prisma.case.deleteMany();
  });

  it("shows only open KYC cases, oldest first, by default", async () => {
    const { items, total } = await listCases(kycQuery(new URLSearchParams()));
    expect(total).toBeGreaterThan(1000);
    for (const c of items) {
      expect(c.type).toBe("kyc");
      expect(["pending", "awaiting_second_approval", "escalated"]).toContain(c.status);
    }
    for (let i = 1; i < items.length; i++) expect(items[i].createdAt >= items[i - 1].createdAt).toBe(true);
  });

  it("filters by status, risk tier and age; status=all removes the status filter", async () => {
    const q = kycQuery(new URLSearchParams("status=rejected&risk=high&minAgeDays=10"));
    expect(q).toMatchObject({ type: "kyc", status: ["rejected"], risk: ["high"], minAgeDays: 10, order: "asc" });
    expect(kycQuery(new URLSearchParams("status=all")).status).toEqual([]);
    expect(() => kycQuery(new URLSearchParams("status=bogus"))).toThrow(/invalid/);
  });

  it("cannot be widened to other case types", () => {
    expect(kycQuery(new URLSearchParams("type=refund")).type).toBe("kyc");
  });

  it("marks open cases past the review target as overdue", () => {
    const now = Date.parse("2026-01-15T12:00:00Z");
    const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();
    expect(ageVsTarget(daysAgo(KYC_TARGET_DAYS + 1), "pending", now).overdue).toBe(true);
    expect(ageVsTarget(daysAgo(KYC_TARGET_DAYS), "pending", now)).toMatchObject({ overdue: false, daysLeft: 0 });
    expect(ageVsTarget(daysAgo(KYC_TARGET_DAYS + 5), "approved", now).overdue).toBe(false);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as cases } from "@/app/api/cases/route";
import { prisma } from "@/core/db";
import { resetAndSeed } from "../prisma/seed-lib";
import { call } from "./helpers";

type Page = { items: { id: string; status: string; createdAt: string; type: string }[]; total: number; page: number; pageSize: number };

describe("P0-3 work queue at 10,000 rows", () => {
  const queries: string[] = [];
  beforeAll(async () => {
    await prisma.user.deleteMany();
    await resetAndSeed(prisma, { count: 10_000, now: new Date() });
    prisma.$on("query", (e) => queries.push(e.query));
  });
  afterAll(async () => {
    await prisma.approval.deleteMany();
    await prisma.case.deleteMany();
  });

  it("seeds 10,000 cases", async () => {
    expect(await prisma.case.count()).toBe(10_000);
  });

  it("returns the first page in under 500 ms", async () => {
    await call(cases, { path: "/api/cases", as: "vera" }); // warm up
    const t0 = performance.now();
    const res = await call(cases, { path: "/api/cases?pageSize=25", as: "vera" });
    const ms = performance.now() - t0;
    expect(res.status).toBe(200);
    const body = res.body as unknown as Page;
    expect(body.items).toHaveLength(25);
    expect(body.total).toBe(10_000);
    expect(ms).toBeLessThan(500);
  });

  it("filters by status and age in the database, never loading all rows", async () => {
    queries.length = 0;
    const res = await call(cases, { path: "/api/cases?status=pending&minAgeDays=30&pageSize=50", as: "vera" });
    const body = res.body as unknown as Page;
    const cutoff = Date.now() - 30 * 86_400_000;
    expect(body.items.length).toBe(50);
    for (const c of body.items) {
      expect(c.status).toBe("pending");
      expect(new Date(c.createdAt).getTime()).toBeLessThanOrEqual(cutoff + 1000);
    }
    const expected = await prisma.case.count({ where: { status: "pending", createdAt: { lte: new Date(cutoff) } } });
    expect(body.total).toBe(expected);
    expect(expected).toBeGreaterThan(50);

    const caseSelects = queries.filter((q) => /SELECT/i.test(q) && /FROM [`"]main[`"]\.[`"]Case[`"]/i.test(q) && !/COUNT\(/i.test(q));
    expect(caseSelects.length).toBeGreaterThan(0);
    for (const q of caseSelects) {
      expect(q).toMatch(/LIMIT/i);
      expect(q).toMatch(/WHERE/i);
    }
  });

  it("sorts oldest first by default and pages without overlap", async () => {
    const p1 = (await call(cases, { path: "/api/cases?pageSize=20&page=1", as: "vera" })).body as unknown as Page;
    const p2 = (await call(cases, { path: "/api/cases?pageSize=20&page=2", as: "vera" })).body as unknown as Page;
    const all = [...p1.items, ...p2.items];
    expect(new Set(all.map((c) => c.id)).size).toBe(40);
    for (let i = 1; i < all.length; i++) expect(all[i].createdAt >= all[i - 1].createdAt).toBe(true);
  });

  it("caps page size and rejects invalid filters", async () => {
    expect((await call(cases, { path: "/api/cases?pageSize=10000", as: "vera" })).status).toBe(400);
    expect((await call(cases, { path: "/api/cases?status=bogus", as: "vera" })).status).toBe(400);
  });
});

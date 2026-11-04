import { beforeEach, describe, expect, it } from "vitest";
import { POST as approveChange } from "@/app/api/flag-changes/[id]/approve/route";
import { POST as rejectChange } from "@/app/api/flag-changes/[id]/reject/route";
import { POST as requestChange } from "@/app/api/flags/[key]/changes/route";
import { POST as kill } from "@/app/api/flags/[key]/kill/route";
import { envStates, evaluate } from "@/apps/flags";
import { verifyAuditChain } from "@/core/audit";
import { prisma } from "@/core/db";
import { seedFlags } from "../prisma/seed-lib";
import { call, resetDb, type UserKey } from "./helpers";

const change = (key: string, as: UserKey, body: unknown) =>
  call(requestChange, { method: "POST", path: `/api/flags/${key}/changes`, as, params: { key }, body });
const approve = (id: string, as: UserKey) => call(approveChange, { method: "POST", path: `/api/flag-changes/${id}/approve`, as, params: { id } });
const flagEnvs = async (key: string) => envStates((await prisma.flag.findUniqueOrThrow({ where: { key } })).envs);
const audit = (action: string) => prisma.auditEntry.findMany({ where: { action }, orderBy: { id: "asc" } });

describe("Feature-flag admin app (on P0-2 roles, P0-4 maker-checker, P0-5 audit)", () => {
  beforeEach(async () => {
    await resetDb();
    await seedFlags(prisma);
  });

  it("applies non-production changes immediately and audits before and after", async () => {
    const res = await change("new-checkout", "riley", { env: "staging", on: false });
    expect(res.body).toEqual({ status: "applied" });
    expect((await flagEnvs("new-checkout")).staging).toEqual({ on: false, plans: [] });
    const [entry] = await audit("flag.change");
    expect(entry.actorId).toBe("u-riley");
    expect(JSON.parse(entry.before!)).toMatchObject({ env: "staging", on: true });
    expect(JSON.parse(entry.after!)).toMatchObject({ env: "staging", on: false });
  });

  it("holds a production change for a second, distinct approver", async () => {
    const res = await change("new-checkout", "avery", { env: "prod", on: true, reason: "launch" });
    expect(res.body.status).toBe("pending");
    const id = res.body.changeId as string;
    expect((await flagEnvs("new-checkout")).prod.on).toBe(false);

    const self = await approve(id, "avery");
    expect(self.status).toBe(403);
    expect(self.body.error).toMatch(/second, distinct approver/);
    expect(await audit("flag.change.approve.refused")).toHaveLength(1);
    expect((await flagEnvs("new-checkout")).prod.on).toBe(false);

    expect((await approve(id, "riley")).status).toBe(403); // reviewers cannot approve production changes
    const ok = await approve(id, "adam");
    expect(ok.body).toEqual({ status: "applied" });
    expect((await flagEnvs("new-checkout")).prod.on).toBe(true);
    expect(await audit("flag.change.approved")).toHaveLength(1);
  });

  it("refuses a second pending production change and requires a reason to reject", async () => {
    const first = await change("dark-mode", "riley", { env: "prod", on: false });
    expect((await change("dark-mode", "riley", { env: "prod", on: false, plans: ["pro"] })).status).toBe(409);
    const id = first.body.changeId as string;
    expect((await call(rejectChange, { method: "POST", path: "/x", as: "avery", params: { id }, body: {} })).status).toBe(400);
    expect((await call(rejectChange, { method: "POST", path: "/x", as: "avery", params: { id }, body: { reason: "not now" } })).body).toEqual({ status: "rejected" });
    expect((await flagEnvs("dark-mode")).prod.on).toBe(true);
  });

  it("refuses viewers, invalid environments and no-op changes", async () => {
    expect((await change("dark-mode", "vera", { env: "dev", on: false })).status).toBe(403);
    expect((await change("dark-mode", "riley", { env: "qa", on: false })).status).toBe(400);
    expect((await change("dark-mode", "riley", { env: "dev", on: true, plans: ["platinum"] })).status).toBe(400);
    expect((await change("dark-mode", "riley", { env: "dev", on: true })).status).toBe(409);
  });

  it("gates a flag by plan tier", async () => {
    const envs = await flagEnvs("instant-payouts");
    expect(evaluate(envs.prod, "enterprise")).toBe(true);
    expect(evaluate(envs.prod, "pro")).toBe(false);
    expect(evaluate(envs.prod, "free")).toBe(false);
  });

  it("kill switch turns a flag off everywhere in one action and cancels pending changes", async () => {
    await change("instant-payouts", "riley", { env: "prod", on: true, plans: [] });
    expect((await call(kill, { method: "POST", path: "/x", as: "riley", params: { key: "instant-payouts" }, body: {} })).status).toBe(400);
    const res = await call(kill, { method: "POST", path: "/x", as: "riley", params: { key: "instant-payouts" }, body: { reason: "payout incident" } });
    expect(res.body).toEqual({ status: "killed", cancelledPendingChanges: 1 });
    const envs = await flagEnvs("instant-payouts");
    expect([envs.dev.on, envs.staging.on, envs.prod.on]).toEqual([false, false, false]);
    expect(await prisma.flagChange.count({ where: { status: "pending" } })).toBe(0);
    expect(await audit("flag.kill")).toHaveLength(1);
    expect((await verifyAuditChain()).ok).toBe(true);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { POST as approve } from "@/app/api/cases/[id]/approve/route";
import { APPROVAL_RULES, requiredApprovals } from "@/config/approval-rules";
import { prisma } from "@/core/db";
import { call, makeCase, resetDb, type UserKey } from "./helpers";

const approveAs = (id: string, as: UserKey) => call(approve, { method: "POST", path: `/api/cases/${id}/approve`, as, params: { id } });
const LIMIT = APPROVAL_RULES.refund.singleApproverLimitCents!;

describe("P0-4 maker-checker", () => {
  beforeEach(resetDb);

  it("refuses a requester approving their own refund, and audits the refusal", async () => {
    const c = await makeCase({ requesterId: "u-riley", amountCents: 1_000 });
    const res = await approveAs(c.id, "riley");
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/requester/);
    expect((await prisma.case.findUnique({ where: { id: c.id } }))!.status).toBe("pending");
    const refusal = await prisma.auditEntry.findFirst({ where: { action: "case.approve.refused", entityId: c.id } });
    expect(refusal?.actorId).toBe("u-riley");
  });

  it("refund at the limit needs one approver", async () => {
    const c = await makeCase({ amountCents: LIMIT });
    expect((await approveAs(c.id, "riley")).body).toEqual({ status: "approved" });
  });

  it("refund above the limit needs a second, distinct approver", async () => {
    const c = await makeCase({ amountCents: LIMIT + 1 });
    expect((await approveAs(c.id, "riley")).body).toEqual({ status: "awaiting_second_approval" });

    const again = await approveAs(c.id, "riley");
    expect(again.status).toBe(403);
    expect(again.body.error).toMatch(/second, distinct approver/);

    expect((await approveAs(c.id, "avery")).body).toEqual({ status: "approved" });
    expect(await prisma.approval.count({ where: { caseId: c.id } })).toBe(2);
  });

  it("requester cannot be the second approver either", async () => {
    const c = await makeCase({ requesterId: "u-avery", amountCents: LIMIT + 1 });
    await approveAs(c.id, "riley");
    expect((await approveAs(c.id, "avery")).status).toBe(403);
    expect((await prisma.case.findUnique({ where: { id: c.id } }))!.status).toBe("awaiting_second_approval");
  });

  it("closed cases cannot be approved again", async () => {
    const c = await makeCase({ amountCents: 100 });
    await approveAs(c.id, "riley");
    expect((await approveAs(c.id, "avery")).status).toBe(409);
  });

  it("limits come from the config file", () => {
    expect(requiredApprovals({ type: "refund", amountCents: LIMIT, risk: "low" })).toBe(1);
    expect(requiredApprovals({ type: "refund", amountCents: LIMIT + 1, risk: "low" })).toBe(2);
    expect(requiredApprovals({ type: "kyc", amountCents: 0, risk: "high" })).toBe(2);
    expect(requiredApprovals({ type: "kyc", amountCents: 0, risk: "medium" })).toBe(1);
  });

  it("concurrent approvals by two users on a two-approver refund end approved with exactly two approvals", async () => {
    const c = await makeCase({ amountCents: LIMIT + 1 });
    const results = await Promise.all([approveAs(c.id, "riley"), approveAs(c.id, "avery")]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 200]);
    expect((await prisma.case.findUnique({ where: { id: c.id } }))!.status).toBe("approved");
    expect(await prisma.approval.count({ where: { caseId: c.id } })).toBe(2);
  });
});

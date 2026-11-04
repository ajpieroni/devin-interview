import { beforeEach, describe, expect, it } from "vitest";
import { POST as approve } from "@/app/api/cases/[id]/approve/route";
import { POST as reject } from "@/app/api/cases/[id]/reject/route";
import { POST as escalate } from "@/app/api/cases/[id]/escalate/route";
import { POST as reveal } from "@/app/api/cases/[id]/reveal/route";
import { GET as caseDetail } from "@/app/api/cases/[id]/route";
import { GET as verify } from "@/app/api/audit/verify/route";
import { GET as exportCsv } from "@/app/api/audit/export/route";
import { GENESIS_HASH, verifyAuditChain, writeAudit } from "@/core/audit";
import { prisma } from "@/core/db";
import { call, makeCase, resetDb } from "./helpers";

describe("P0-5 audit log", () => {
  beforeEach(resetDb);

  async function scenario() {
    const kyc = await makeCase({ type: "kyc", amountCents: 0, sensitive: JSON.stringify({ governmentId: "ID-123456789", dateOfBirth: "1990-01-01" }) });
    const refund = await makeCase({ amountCents: 2_500 });
    await call(reveal, { method: "POST", path: `/api/cases/${kyc.id}/reveal`, as: "riley", params: { id: kyc.id }, body: { field: "governmentId" } });
    await call(approve, { method: "POST", path: `/api/cases/${kyc.id}/approve`, as: "riley", params: { id: kyc.id } });
    await call(reject, { method: "POST", path: `/api/cases/${refund.id}/reject`, as: "avery", params: { id: refund.id }, body: { reason: "Duplicate" } });
    return { kyc, refund };
  }

  it("writes actor, action, entity, before/after, time, request id and previous hash for each decision and reveal", async () => {
    const { kyc, refund } = await scenario();
    const rows = await prisma.auditEntry.findMany({ orderBy: { id: "asc" } });
    expect(rows.map((r) => r.action)).toEqual(["field.reveal", "case.approve", "case.reject"]);
    expect(rows[0]).toMatchObject({ actorId: "u-riley", entityType: "case", entityId: kyc.id, prevHash: GENESIS_HASH });
    expect(JSON.parse(rows[1].before!)).toMatchObject({ status: "pending" });
    expect(JSON.parse(rows[1].after!)).toMatchObject({ status: "approved", approvals: 1 });
    expect(rows[2]).toMatchObject({ actorId: "u-avery", entityId: refund.id });
    expect(JSON.parse(rows[2].after!)).toMatchObject({ status: "rejected", reason: "Duplicate", amountCents: 2_500 });
    for (let i = 0; i < rows.length; i++) {
      expect(rows[i].requestId).toBeTruthy();
      expect(rows[i].createdAt).toBeInstanceOf(Date);
      if (i > 0) expect(rows[i].prevHash).toBe(rows[i - 1].hash);
    }
  });

  it("masks sensitive fields by default and never writes the revealed value to the log", async () => {
    const { kyc } = await scenario();
    const detail = await call(caseDetail, { path: `/api/cases/${kyc.id}`, as: "riley", params: { id: kyc.id } });
    expect(JSON.stringify(detail.body)).not.toContain("ID-123456789");
    expect((detail.body as { masked: Record<string, string> }).masked.governmentId).toBe("••••••");
    const all = JSON.stringify(await prisma.auditEntry.findMany());
    expect(all).not.toContain("ID-123456789");
  });

  it("requires a reason to reject or escalate", async () => {
    const c = await makeCase();
    for (const handler of [reject, escalate]) {
      const res = await call(handler, { method: "POST", path: `/api/cases/${c.id}/x`, as: "riley", params: { id: c.id }, body: { reason: "  " } });
      expect(res.status).toBe(400);
    }
    expect(await prisma.auditEntry.count()).toBe(0);
  });

  it("verify passes on an untouched chain", async () => {
    await scenario();
    const res = await call(verify, { path: "/api/audit/verify", as: "adam" });
    expect(res.body).toEqual({ ok: true, checked: 3 });
  });

  it("verify fails after a row is edited directly in the database", async () => {
    await scenario();
    const target = await prisma.auditEntry.findFirstOrThrow({ where: { action: "case.approve" } });
    await prisma.$executeRaw`UPDATE AuditEntry SET actorId = 'u-mallory' WHERE id = ${target.id}`;
    const res = await call(verify, { path: "/api/audit/verify", as: "adam" });
    expect(res.body).toMatchObject({ ok: false, brokenAtId: target.id });
  });

  it("verify fails after a row is deleted", async () => {
    await scenario();
    const first = await prisma.auditEntry.findFirstOrThrow({ orderBy: { id: "asc" } });
    await prisma.$executeRaw`DELETE FROM AuditEntry WHERE id = ${first.id}`;
    expect((await verifyAuditChain()).ok).toBe(false);
  });

  it("keeps the chain intact under concurrent writes", async () => {
    await Promise.all(Array.from({ length: 20 }, (_, i) => writeAudit({ actorId: "u-adam", action: "test", entityType: "x", entityId: String(i), requestId: `r${i}` })));
    expect(await verifyAuditChain()).toEqual({ ok: true, checked: 20 });
  });

  it("exports CSV with a header row and one row per entry", async () => {
    await scenario();
    const res = await call(exportCsv, { path: "/api/audit/export", as: "adam" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const lines = String(res.body).trim().split("\n");
    expect(lines[0]).toBe("id,createdAt,actorId,action,entityType,entityId,before,after,requestId,prevHash,hash");
    expect(lines).toHaveLength(4);
  });
});

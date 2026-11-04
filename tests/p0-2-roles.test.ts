import { beforeEach, describe, expect, it } from "vitest";
import { POST as approve } from "@/app/api/cases/[id]/approve/route";
import { POST as reveal } from "@/app/api/cases/[id]/reveal/route";
import { GET as verify } from "@/app/api/audit/verify/route";
import { GET as cases } from "@/app/api/cases/route";
import { PERMISSIONS, can } from "@/config/policy";
import { prisma } from "@/core/db";
import { call, makeCase, resetDb } from "./helpers";

describe("P0-2 roles", () => {
  beforeEach(resetDb);

  it("viewer calling approve gets 403 and a denied event in the audit log", async () => {
    const c = await makeCase();
    const res = await call(approve, { method: "POST", path: `/api/cases/${c.id}/approve`, as: "vera", params: { id: c.id } });
    expect(res.status).toBe(403);

    const denied = await prisma.auditEntry.findMany({ where: { action: "access.denied" } });
    expect(denied).toHaveLength(1);
    expect(denied[0]).toMatchObject({ actorId: "u-vera", entityType: "route", entityId: `POST /api/cases/${c.id}/approve` });
    expect(JSON.parse(denied[0].after!)).toEqual({ permission: "cases:approve", roles: ["viewer"] });
    expect((await prisma.case.findUnique({ where: { id: c.id } }))!.status).toBe("pending");
    expect(await prisma.approval.count()).toBe(0);
  });

  it("viewer can read the queue but not reveal masked fields", async () => {
    const c = await makeCase({ type: "kyc", sensitive: JSON.stringify({ governmentId: "ID-1" }) });
    expect((await call(cases, { path: "/api/cases", as: "vera" })).status).toBe(200);
    expect((await call(reveal, { method: "POST", path: `/api/cases/${c.id}/reveal`, as: "vera", params: { id: c.id }, body: { field: "governmentId" } })).status).toBe(403);
  });

  it("only admin can verify the audit chain", async () => {
    for (const as of ["vera", "riley", "avery"] as const) {
      expect((await call(verify, { path: "/api/audit/verify", as })).status).toBe(403);
    }
    expect((await call(verify, { path: "/api/audit/verify", as: "adam" })).status).toBe(200);
  });

  it("reviewer can approve", async () => {
    const c = await makeCase();
    const res = await call(approve, { method: "POST", path: `/api/cases/${c.id}/approve`, as: "riley", params: { id: c.id } });
    expect(res.status).toBe(200);
  });

  it("policy table: viewer is read-only, unknown permissions are denied for everyone", () => {
    for (const [perm, roles] of Object.entries(PERMISSIONS)) {
      const readOnly = perm.endsWith(":read") && perm !== "audit:read";
      expect((roles as readonly string[]).includes("viewer")).toBe(readOnly);
    }
    expect(can(["admin"], "cases:delete")).toBe(false);
    expect(can([], "cases:read")).toBe(false);
  });
});

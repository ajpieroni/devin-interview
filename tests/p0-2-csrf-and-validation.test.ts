import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as approve } from "@/app/api/cases/[id]/approve/route";
import { POST as reject } from "@/app/api/cases/[id]/reject/route";
import { POST as reveal } from "@/app/api/cases/[id]/reveal/route";
import { GET as cases } from "@/app/api/cases/route";
import { middleware } from "@/middleware";
import { call, makeCase, resetDb, sessionCookie } from "./helpers";

const request = (method: string, path: string, headers: Record<string, string>) =>
  new NextRequest(new URL(path, "http://localhost:3000"), { method, headers });

describe("P0-2 roles: CSRF, input validation and denial messages", () => {
  beforeEach(resetDb);

  it("refuses a state-changing request from another origin", async () => {
    const cookie = await sessionCookie("riley");
    const res = await middleware(request("POST", "/api/cases/c-1/approve", { cookie, host: "localhost:3000", origin: "https://evil.example" }));
    expect(res.status).toBe(403);
  });

  it("refuses a state-changing request with no Origin header", async () => {
    const cookie = await sessionCookie("riley");
    const res = await middleware(request("POST", "/api/cases/c-1/approve", { cookie, host: "localhost:3000" }));
    expect(res.status).toBe(403);
  });

  it("lets same-origin writes and all reads through", async () => {
    const cookie = await sessionCookie("riley");
    const write = await middleware(request("POST", "/api/cases/c-1/approve", { cookie, host: "localhost:3000", origin: "http://localhost:3000" }));
    expect(write.status).toBe(200);
    const read = await middleware(request("GET", "/api/cases", { cookie, host: "localhost:3000" }));
    expect(read.status).toBe(200);
  });

  it("rejects invalid query values, unknown body fields and malformed ids with 400", async () => {
    const c = await makeCase();
    const path = `/api/cases/${c.id}/reject`;
    expect((await call(cases, { path: "/api/cases?type=bogus", as: "vera" })).status).toBe(400);
    expect((await call(cases, { path: "/api/cases?page=0", as: "vera" })).status).toBe(400);
    expect((await call(reject, { method: "POST", path, as: "riley", params: { id: c.id }, body: { reason: "dup", extra: 1 } })).status).toBe(400);
    expect((await call(reject, { method: "POST", path, as: "riley", params: { id: c.id }, body: { reason: 42 } })).status).toBe(400);
    expect((await call(reject, { method: "POST", path, as: "riley", params: { id: "../etc" }, body: { reason: "dup" } })).status).toBe(400);
    expect((await call(reveal, { method: "POST", path, as: "riley", params: { id: c.id }, body: { field: "__proto__" } })).status).toBe(400);
  });

  it("explains a denied action in plain language", async () => {
    const c = await makeCase();
    const res = await call(approve, { method: "POST", path: `/api/cases/${c.id}/approve`, as: "vera", params: { id: c.id } });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/your role \(viewer\) cannot approve cases/);
    expect(res.body.error).toMatch(/Allowed roles: reviewer, approver, admin/);
  });
});

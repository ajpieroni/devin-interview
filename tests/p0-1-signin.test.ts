import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { middleware } from "@/middleware";
import { GET as login } from "@/app/api/auth/login/route";
import { GET as callback } from "@/app/api/auth/callback/route";
import { GET as devApprove } from "@/app/dev-idp/authorize/approve/route";
import { GET as me } from "@/app/api/me/route";
import { prisma } from "@/core/db";
import { call, resetDb, sessionCookie } from "./helpers";

function req(path: string, cookie?: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"), { headers: cookie ? { cookie } : {} });
}

describe("P0-1 sign-in", () => {
  beforeEach(resetDb);

  it.each(["/", "/cases", "/cases/abc", "/audit"])("redirects unauthenticated page %s to login", async (path) => {
    const res = await middleware(req(path));
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/login");
    expect(loc.searchParams.get("next")).toBe(path);
  });

  it.each(["/api/cases", "/api/cases/abc/approve", "/api/audit/verify", "/api/me"])("rejects unauthenticated API %s with 401", async (path) => {
    const res = await middleware(req(path));
    expect(res.status).toBe(401);
  });

  it("falls back to the dev session secret when SESSION_SECRET is empty", async () => {
    const prev = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "";
    try {
      const { sessionSecret } = await import("@/config/auth");
      expect(sessionSecret().length).toBeGreaterThanOrEqual(32);
    } finally {
      process.env.SESSION_SECRET = prev;
    }
  });

  it("rejects a forged or tampered session cookie", async () => {
    const good = await sessionCookie("adam");
    const forged = good.slice(0, -4) + "AAAA";
    expect((await middleware(req("/cases", forged))).status).toBe(307);
    expect((await call(me, { path: "/api/me", cookie: forged })).status).toBe(401);
  });

  it("lets an authenticated request through", async () => {
    const res = await middleware(req("/cases", await sessionCookie("vera")));
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("completes the OIDC-shaped login flow through the dev IdP adapter", async () => {
    const start = await login(req("/api/auth/login?next=/audit"));
    expect(start.status).toBe(307);
    const authorize = new URL(start.headers.get("location")!);
    expect(authorize.pathname).toBe("/dev-idp/authorize");
    const state = authorize.searchParams.get("state")!;
    const stateCookie = start.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

    const approveUrl = `/dev-idp/authorize/approve?${new URLSearchParams({ sub: "u-avery", state, redirect_uri: authorize.searchParams.get("redirect_uri")! })}`;
    const approved = await devApprove(req(approveUrl));
    const cb = new URL(approved.headers.get("location")!);
    expect(cb.pathname).toBe("/api/auth/callback");

    const done = await callback(req(cb.pathname + cb.search, stateCookie));
    expect(done.status).toBe(307);
    expect(new URL(done.headers.get("location")!).pathname).toBe("/audit");
    const session = done.headers.getSetCookie().find((c) => c.startsWith("session="))!;
    expect(session).toContain("HttpOnly");

    const who = await call(me, { path: "/api/me", cookie: session.split(";")[0] });
    expect(who.status).toBe(200);
    expect((who.body as { user: { id: string; roles: string[] } }).user).toMatchObject({ id: "u-avery", roles: ["approver"] });
    expect(await prisma.user.findUnique({ where: { id: "u-avery" } })).toMatchObject({ roles: "approver" });
    expect(await prisma.auditEntry.count({ where: { action: "auth.login", actorId: "u-avery" } })).toBe(1);
  });

  it("refuses a callback whose state does not match the cookie", async () => {
    const start = await login(req("/api/auth/login"));
    const authorize = new URL(start.headers.get("location")!);
    const approved = await devApprove(
      req(`/dev-idp/authorize/approve?${new URLSearchParams({ sub: "u-adam", state: authorize.searchParams.get("state")!, redirect_uri: authorize.searchParams.get("redirect_uri")! })}`),

    );
    const cb = new URL(approved.headers.get("location")!);
    const res = await callback(req(cb.pathname + cb.search, "auth_state=someone-elses-state"));
    expect(res.status).toBe(400);
  });

  it("does not redirect to another site after login", async () => {
    const start = await login(req("/api/auth/login?next=//evil.example.com"));
    const next = start.headers.getSetCookie().find((c) => c.startsWith("auth_next="))!;
    expect(decodeURIComponent(next.split(";")[0].split("=")[1])).toBe("/cases");
  });
});

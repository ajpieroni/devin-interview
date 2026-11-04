import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scanRoutePolicies } from "@/core/route-policy";

describe("P0-6 default deny: Policy page scan", () => {
  it("lists every route and page and passes on this app", () => {
    const routes = scanRoutePolicies(path.resolve(__dirname, "../src/app"));
    expect(routes.length).toBeGreaterThan(20);
    expect(routes.filter((r) => !r.ok)).toEqual([]);
    expect(routes.find((r) => r.path === "/api/cases/[id]/approve")?.roles).toEqual(["reviewer", "approver", "admin"]);
    expect(routes.find((r) => r.path === "/audit")?.policy).toBe("audit:read");
  });

  it("flags routes and pages without a policy, and public routes off the allowlist", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "policy-scan-"));
    const put = (rel: string, src: string) => {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), src);
    };
    put("api/open/route.ts", 'export async function GET() { return new Response("") }');
    put("api/sneaky/route.ts", "export const POST = publicRoute(async () => new Response(''))");
    put("secret/page.tsx", "export default function P() { return null }");
    const byPath = Object.fromEntries(scanRoutePolicies(dir).map((r) => [r.path, r]));
    expect(byPath["/api/open"]).toMatchObject({ ok: false, problem: "no policy declared" });
    expect(byPath["/api/sneaky"]).toMatchObject({ ok: false, problem: "public but not allowlisted" });
    expect(byPath["/secret"]).toMatchObject({ ok: false, problem: "no policy declared" });
    fs.rmSync(dir, { recursive: true });
  });
});

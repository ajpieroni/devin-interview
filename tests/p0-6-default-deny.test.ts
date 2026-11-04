import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isPermission } from "@/config/policy";
import { PUBLIC_PATH_PREFIXES } from "@/middleware";

const APP_DIR = path.resolve(__dirname, "../src/app");
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

// The only routes and pages allowed without a role. Adding to these lists is a reviewable change.
const PUBLIC_ROUTES = ["api/auth/login", "api/auth/callback", "api/auth/logout", "dev-idp/authorize/approve"];
const PUBLIC_PAGES = ["login", "forbidden", "dev-idp/authorize"];

function find(name: string) {
  return (fs.readdirSync(APP_DIR, { recursive: true }) as string[])
    .filter((f) => path.basename(f) === name)
    .map((f) => ({ file: path.join(APP_DIR, f), route: path.dirname(f).split(path.sep).join("/").replace(/^\.$/, "") }));
}

describe("P0-6 default deny", () => {
  const routes = find("route.ts");
  const pages = find("page.tsx");

  it("finds the route and page files", () => {
    expect(routes.length).toBeGreaterThanOrEqual(10);
    expect(pages.length).toBeGreaterThanOrEqual(5);
  });

  it.each(find("route.ts"))("route $route declares a policy for every handler", async ({ file, route }) => {
    const mod = (await import(file)) as Record<string, unknown>;
    const handlers = Object.entries(mod).filter(([k]) => HTTP_METHODS.includes(k));
    expect(handlers.length).toBeGreaterThan(0);
    for (const [method, handler] of handlers) {
      const policy = (handler as { __policy?: string }).__policy;
      expect(policy, `${method} /${route} has no policy`).toBeDefined();
      if (policy === "public") expect(PUBLIC_ROUTES, `${method} /${route} is public but not allowlisted`).toContain(route);
      else expect(isPermission(policy!), `${method} /${route} uses unknown permission ${policy}`).toBe(true);
    }
  });

  it.each(find("page.tsx"))("page /$route calls requirePage or is allowlisted", ({ file, route }) => {
    if (PUBLIC_PAGES.includes(route)) return;
    expect(fs.readFileSync(file, "utf8"), `/${route} has no requirePage(...)`).toMatch(/await requirePage\("[a-z:]+"/);
  });

  it("middleware only exempts the allowlisted public paths", () => {
    expect(PUBLIC_PATH_PREFIXES).toEqual(["/login", "/forbidden", "/api/auth/", "/dev-idp/"]);
    const exemptRoutes = [...routes, ...pages].map((r) => `/${r.route}`).filter((r) => PUBLIC_PATH_PREFIXES.some((p) => r === p || r.startsWith(p.endsWith("/") ? p : `${p}/`)));
    for (const r of exemptRoutes) expect([...PUBLIC_ROUTES, ...PUBLIC_PAGES].map((x) => `/${x}`)).toContain(r);
  });
});

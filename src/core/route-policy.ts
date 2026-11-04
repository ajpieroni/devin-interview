import fs from "node:fs";
import path from "node:path";
import { PERMISSIONS, PUBLIC_PAGES, PUBLIC_ROUTES, isPermission } from "@/config/policy";

export interface RoutePolicy {
  path: string;
  kind: "api" | "page";
  method: string;
  policy: string | null;
  roles: string[];
  ok: boolean;
  problem?: string;
}

const METHODS = "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS";

// Static scan of src/app, mirroring the P0-6 test: every API handler must be
// wrapped in withPolicy(...) or an allowlisted publicRoute(...), and every page
// must call requirePage(...) unless allowlisted.
export function scanRoutePolicies(appDir = path.join(/*turbopackIgnore: true*/ process.cwd(), "src/app")): RoutePolicy[] {
  const files = (fs.readdirSync(/*turbopackIgnore: true*/ appDir, { recursive: true }) as string[]).filter((f) => /(^|[\\/])(route\.ts|page\.tsx)$/.test(f));
  const out: RoutePolicy[] = [];
  for (const f of files.sort()) {
    const dir = path.dirname(f).split(path.sep).join("/").replace(/^\.$/, "");
    const src = fs.readFileSync(/*turbopackIgnore: true*/ path.join(appDir, f), "utf8");
    if (f.endsWith("route.ts")) {
      const declared = [...src.matchAll(new RegExp(`export (?:const|async function|function) (${METHODS})\\b`, "g"))].map((m) => m[1]);
      if (declared.length === 0) out.push({ path: `/${dir}`, kind: "api", method: "-", policy: null, roles: [], ok: false, problem: "no handlers found" });
      for (const method of declared) {
        const m = src.match(new RegExp(`export const ${method}\\s*=\\s*(?:withPolicy\\(\\s*"([a-z:]+)"|(publicRoute)\\()`));
        out.push(entry(`/${dir}`, "api", method, m ? (m[1] ?? "public") : null, PUBLIC_ROUTES.includes(dir)));
      }
    } else {
      const m = src.match(/await requirePage\("([a-z:]+)"/);
      out.push(entry(`/${dir}`, "page", "GET", m ? m[1] : PUBLIC_PAGES.includes(dir) ? "public" : null, PUBLIC_PAGES.includes(dir)));
    }
  }
  return out;
}

function entry(p: string, kind: "api" | "page", method: string, policy: string | null, allowlisted: boolean): RoutePolicy {
  if (policy === null) return { path: p, kind, method, policy, roles: [], ok: false, problem: "no policy declared" };
  if (policy === "public") {
    return allowlisted
      ? { path: p, kind, method, policy, roles: ["anyone (public allowlist)"], ok: true }
      : { path: p, kind, method, policy, roles: [], ok: false, problem: "public but not allowlisted" };
  }
  if (!isPermission(policy)) return { path: p, kind, method, policy, roles: [], ok: false, problem: `unknown permission ${policy}` };
  return { path: p, kind, method, policy, roles: [...PERMISSIONS[policy]], ok: true };
}

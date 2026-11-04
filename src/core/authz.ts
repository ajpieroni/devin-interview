import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/config/auth";
import { can, type Permission } from "@/config/policy";
import { readSessionToken, type SessionUser } from "./auth/session";
import { writeAudit } from "./audit";
import { HttpError, json } from "./http";

export interface RouteContext {
  user: SessionUser;
  requestId: string;
  params: Record<string, string>;
}

type NextRouteContext = { params: Promise<Record<string, string>> };
type Handler = (req: NextRequest, ctx: RouteContext) => Promise<Response>;

export type PolicyTagged = { __policy: Permission | "public" };

// Every API handler must be wrapped in withPolicy (or publicRoute). A test
// enumerates all route files and fails on any handler without a policy tag.
export function withPolicy(permission: Permission, handler: Handler) {
  const wrapped = async (req: NextRequest, routeCtx: NextRouteContext): Promise<Response> => {
    const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
    const user = await readSessionToken(req.cookies.get(SESSION_COOKIE)?.value);
    if (!user) return json(401, { error: "unauthenticated" });
    if (!can(user.roles, permission)) {
      await writeAudit({
        actorId: user.id,
        action: "access.denied",
        entityType: "route",
        entityId: `${req.method} ${req.nextUrl.pathname}`,
        after: { permission, roles: user.roles },
        requestId,
      });
      return json(403, { error: "forbidden", permission });
    }
    const params = (await routeCtx?.params) ?? {};
    try {
      return await handler(req, { user, requestId, params });
    } catch (err) {
      if (err instanceof HttpError) return json(err.status, { error: err.message });
      throw err;
    }
  };
  return Object.assign(wrapped, { __policy: permission } as PolicyTagged);
}

export function publicRoute<T extends (...args: never[]) => Promise<Response>>(handler: T): T & PolicyTagged {
  return Object.assign(handler, { __policy: "public" } as PolicyTagged);
}

export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

// Server components call this first. Pages without it fail the default-deny test.
export async function requirePage(permission: Permission, path: string): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (!can(user.roles, permission)) {
    await writeAudit({
      actorId: user.id,
      action: "access.denied",
      entityType: "page",
      entityId: path,
      after: { permission, roles: user.roles },
      requestId: crypto.randomUUID(),
    });
    redirect("/forbidden");
  }
  return user;
}

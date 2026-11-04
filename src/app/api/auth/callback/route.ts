import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/config/auth";
import { rolesFromGroups } from "@/config/policy";
import { publicRoute } from "@/core/authz";
import { writeAudit } from "@/core/audit";
import { getIdentityProvider } from "@/core/auth/idp";
import { createSessionToken } from "@/core/auth/session";
import { callbackUrl, safeNext } from "@/core/auth/urls";
import { prisma } from "@/core/db";
import { json } from "@/core/http";

export const GET = publicRoute(async (req: NextRequest) => {
  let identity;
  try {
    identity = await getIdentityProvider().handleCallback(
      req.nextUrl.searchParams,
      req.cookies.get("auth_state")?.value,
      callbackUrl(req),
    );
  } catch {
    return json(400, { error: "login failed" });
  }
  const roles = rolesFromGroups(identity.groups);
  const user = await prisma.user.upsert({
    where: { id: identity.sub },
    create: { id: identity.sub, email: identity.email, name: identity.name, roles: roles.join(",") },
    update: { email: identity.email, name: identity.name, roles: roles.join(",") },
  });
  await writeAudit({
    actorId: user.id,
    action: "auth.login",
    entityType: "user",
    entityId: user.id,
    after: { roles },
    requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
  });
  const token = await createSessionToken({ id: user.id, email: user.email, name: user.name, roles });
  const res = NextResponse.redirect(new URL(safeNext(req.cookies.get("auth_next")?.value), req.nextUrl.origin));
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    secure: req.nextUrl.protocol === "https:",
  });
  res.cookies.delete({ name: "auth_state", path: "/api/auth" });
  res.cookies.delete({ name: "auth_next", path: "/api/auth" });
  return res;
});

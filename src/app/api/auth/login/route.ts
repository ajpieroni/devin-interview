import { NextResponse, type NextRequest } from "next/server";
import { publicRoute } from "@/core/authz";
import { getIdentityProvider } from "@/core/auth/idp";
import { callbackUrl, safeNext } from "@/core/auth/urls";

export const GET = publicRoute(async (req: NextRequest) => {
  const auth = await getIdentityProvider().createAuthRequest(callbackUrl(req));
  const res = NextResponse.redirect(new URL(auth.url, req.nextUrl.origin));
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/api/auth", maxAge: 600, secure: req.nextUrl.protocol === "https:" };
  res.cookies.set("auth_state", auth.stateCookie, opts);
  res.cookies.set("auth_next", safeNext(req.nextUrl.searchParams.get("next")), opts);
  return res;
});

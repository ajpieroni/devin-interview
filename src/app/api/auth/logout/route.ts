import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/config/auth";
import { publicRoute } from "@/core/authz";

// Public on purpose: clearing your own session cookie needs no role.
export const POST = publicRoute(async (req: NextRequest) => {
  const res = NextResponse.redirect(new URL("/login", req.nextUrl.origin), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
});

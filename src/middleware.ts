import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/config/auth";
import { readSessionToken } from "@/core/auth/session";

// Paths reachable without a session. Everything else requires login; role
// checks then happen server-side in withPolicy / requirePage.
export const PUBLIC_PATH_PREFIXES = ["/login", "/forbidden", "/api/auth/", "/dev-idp/"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((p) => (p.endsWith("/") ? pathname.startsWith(p) : pathname === p || pathname.startsWith(`${p}/`)));
}

export async function middleware(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const headers = new Headers(req.headers);
  headers.set("x-request-id", requestId);
  const { pathname, search } = req.nextUrl;

  if (!isPublicPath(pathname)) {
    const user = await readSessionToken(req.cookies.get(SESSION_COOKIE)?.value);
    if (!user) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
      const login = new URL("/login", req.nextUrl.origin);
      login.searchParams.set("next", pathname + search);
      return NextResponse.redirect(login);
    }
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

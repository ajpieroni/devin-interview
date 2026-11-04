import type { NextRequest } from "next/server";

export function callbackUrl(req: NextRequest): string {
  const base = process.env.APP_URL ?? req.nextUrl.origin;
  return `${base.replace(/\/$/, "")}/api/auth/callback`;
}

// Only same-site relative paths, to avoid open redirects after login.
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/cases";
  return next;
}

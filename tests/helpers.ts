import { NextRequest } from "next/server";
import { DEV_USERS, SESSION_COOKIE } from "@/config/auth";
import { rolesFromGroups } from "@/config/policy";
import { createSessionToken } from "@/core/auth/session";
import { prisma } from "@/core/db";

export type UserKey = "vera" | "riley" | "avery" | "adam";

export function devUser(key: UserKey) {
  const u = DEV_USERS.find((x) => x.sub === `u-${key}`)!;
  return { id: u.sub, email: u.email, name: u.name, roles: rolesFromGroups(u.groups) };
}

export async function sessionCookie(key: UserKey) {
  return `${SESSION_COOKIE}=${await createSessionToken(devUser(key))}`;
}

type RouteHandler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export async function call(
  handler: RouteHandler,
  opts: { method?: string; path: string; as?: UserKey; body?: unknown; params?: Record<string, string>; cookie?: string },
) {
  const headers = new Headers();
  if (opts.as) headers.set("cookie", await sessionCookie(opts.as));
  if (opts.cookie) headers.set("cookie", opts.cookie);
  if (opts.body !== undefined) headers.set("content-type", "application/json");
  const req = new NextRequest(new URL(opts.path, "http://localhost:3000"), {
    method: opts.method ?? "GET",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {}
  return { status: res.status, body: body as Record<string, unknown> & unknown, headers: res.headers };
}

export async function resetDb() {
  await prisma.approval.deleteMany();
  await prisma.case.deleteMany();
  await prisma.auditEntry.deleteMany();
  await prisma.user.deleteMany();
}

export async function makeCase(over: Partial<{ type: string; status: string; requesterId: string; amountCents: number; risk: string; sensitive: string; data: string }> = {}) {
  return prisma.case.create({
    data: {
      type: "refund",
      status: "pending",
      requesterId: "u-someone",
      amountCents: 10_000,
      risk: "low",
      ...over,
    },
  });
}

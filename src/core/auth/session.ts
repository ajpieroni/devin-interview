import { SignJWT, jwtVerify } from "jose";
import { SESSION_TTL_SECONDS, sessionSecret } from "@/config/auth";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name, roles: user.roles })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(sessionSecret());
}

export async function readSessionToken(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"] });
    if (!payload.sub || !Array.isArray(payload.roles)) return null;
    return {
      id: payload.sub,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      roles: (payload.roles as unknown[]).map(String),
    };
  } catch {
    return null;
  }
}

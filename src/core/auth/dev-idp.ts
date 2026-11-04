import { SignJWT, jwtVerify } from "jose";
import { DEV_USERS, sessionSecret } from "@/config/auth";
import type { AuthRequest, Identity, IdentityProvider } from "./idp";

// Local stand-in for the company IdP. Mirrors the OIDC authorization-code
// shape (authorize -> code -> callback) without running a separate server.
export class DevIdp implements IdentityProvider {
  async createAuthRequest(redirectUri: string): Promise<AuthRequest> {
    const state = crypto.randomUUID();
    const url = `/dev-idp/authorize?${new URLSearchParams({ state, redirect_uri: redirectUri })}`;
    return { url, stateCookie: state };
  }

  async handleCallback(params: URLSearchParams, stateCookie: string | undefined): Promise<Identity> {
    const state = params.get("state");
    const code = params.get("code");
    if (!state || !stateCookie || state !== stateCookie) throw new Error("state mismatch");
    if (!code) throw new Error("missing code");
    const { payload } = await jwtVerify(code, sessionSecret(), { audience: "dev-idp-code" });
    if (payload.state !== state) throw new Error("code/state mismatch");
    const user = DEV_USERS.find((u) => u.sub === payload.sub);
    if (!user) throw new Error("unknown user");
    return { sub: user.sub, email: user.email, name: user.name, groups: user.groups };
  }
}

export async function issueDevCode(sub: string, state: string): Promise<string> {
  if (!DEV_USERS.some((u) => u.sub === sub)) throw new Error("unknown user");
  return new SignJWT({ state })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setAudience("dev-idp-code")
    .setExpirationTime("60s")
    .sign(sessionSecret());
}

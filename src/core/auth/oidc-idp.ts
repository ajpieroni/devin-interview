import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AuthRequest, Identity, IdentityProvider } from "./idp";

// Generic OIDC authorization-code + PKCE adapter. Configured by env only:
// OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_SCOPES (optional).
// Not exercised in the prototype; documented as the production seam.
export class OidcIdp implements IdentityProvider {
  private issuer = required("OIDC_ISSUER");
  private clientId = required("OIDC_CLIENT_ID");
  private clientSecret = process.env.OIDC_CLIENT_SECRET;
  private scopes = process.env.OIDC_SCOPES ?? "openid email profile";

  private async discovery() {
    const res = await fetch(`${this.issuer.replace(/\/$/, "")}/.well-known/openid-configuration`);
    if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
    return (await res.json()) as { authorization_endpoint: string; token_endpoint: string; jwks_uri: string; issuer: string };
  }

  async createAuthRequest(redirectUri: string): Promise<AuthRequest> {
    const d = await this.discovery();
    const state = crypto.randomUUID();
    const nonce = crypto.randomUUID();
    const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
    const url = `${d.authorization_endpoint}?${new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: this.scopes,
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
    })}`;
    return { url, stateCookie: JSON.stringify({ state, nonce, verifier }) };
  }

  async handleCallback(params: URLSearchParams, stateCookie: string | undefined, redirectUri: string): Promise<Identity> {
    const saved = JSON.parse(stateCookie ?? "{}") as { state?: string; nonce?: string; verifier?: string };
    if (!saved.state || params.get("state") !== saved.state) throw new Error("state mismatch");
    const d = await this.discovery();
    const res = await fetch(d.token_endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: params.get("code") ?? "",
        redirect_uri: redirectUri,
        client_id: this.clientId,
        ...(this.clientSecret ? { client_secret: this.clientSecret } : {}),
        code_verifier: saved.verifier ?? "",
      }),
    });
    if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
    const { id_token } = (await res.json()) as { id_token: string };
    const { payload } = await jwtVerify(id_token, createRemoteJWKSet(new URL(d.jwks_uri)), {
      issuer: d.issuer,
      audience: this.clientId,
    });
    if (payload.nonce !== saved.nonce) throw new Error("nonce mismatch");
    return {
      sub: String(payload.sub),
      email: String(payload.email ?? payload.preferred_username ?? ""),
      name: String(payload.name ?? payload.email ?? payload.sub),
      groups: Array.isArray(payload.groups) ? payload.groups.map(String) : [],
    };
  }
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} must be set when IDP=oidc`);
  return v;
}

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

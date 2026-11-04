import { IDP } from "@/config/auth";
import { DevIdp } from "./dev-idp";
import { OidcIdp } from "./oidc-idp";

export interface Identity {
  sub: string;
  email: string;
  name: string;
  groups: string[];
}

export interface AuthRequest {
  url: string;
  // Opaque state the adapter needs back at callback time (stored in an httpOnly cookie).
  stateCookie: string;
}

// The seam where the company IdP plugs in. Adapters are chosen by config (IDP env var).
export interface IdentityProvider {
  createAuthRequest(redirectUri: string): Promise<AuthRequest>;
  handleCallback(params: URLSearchParams, stateCookie: string | undefined, redirectUri: string): Promise<Identity>;
}

export function getIdentityProvider(): IdentityProvider {
  return IDP === "oidc" ? new OidcIdp() : new DevIdp();
}

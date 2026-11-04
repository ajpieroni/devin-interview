// Identity provider selection. Swapping the IdP is configuration only:
//   IDP=dev   -> built-in local dev IdP (default, for development and demos)
//   IDP=oidc  -> any OIDC provider (Entra ID, Okta, Google) via OIDC_ISSUER,
//                OIDC_CLIENT_ID, OIDC_CLIENT_SECRET. Roles come from the
//                `groups` claim mapped through GROUP_ROLE_MAP in policy.ts.

export const IDP = (process.env.IDP ?? "dev") as "dev" | "oidc";

export const SESSION_COOKIE = "session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

const DEV_SECRET = "dev-only-session-secret-change-me-0123456789";

export function sessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production" && IDP !== "dev") {
    throw new Error("SESSION_SECRET must be set in production");
  }
  return new TextEncoder().encode(secret ?? DEV_SECRET);
}

export interface DevUser {
  sub: string;
  email: string;
  name: string;
  groups: string[];
}

export const DEV_USERS: DevUser[] = [
  { sub: "u-vera", email: "vera@example.test", name: "Vera Viewer", groups: ["tools-viewers"] },
  { sub: "u-riley", email: "riley@example.test", name: "Riley Reviewer", groups: ["tools-reviewers"] },
  { sub: "u-avery", email: "avery@example.test", name: "Avery Approver", groups: ["tools-approvers"] },
  { sub: "u-adam", email: "adam@example.test", name: "Adam Admin", groups: ["tools-admins"] },
];

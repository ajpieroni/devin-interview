// Single source of truth for authorization. Every route and page must declare
// one of these permissions (or be explicitly public); anything else is denied.

export const ROLES = ["viewer", "reviewer", "approver", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = {
  "session:read": ["viewer", "reviewer", "approver", "admin"],
  "cases:read": ["viewer", "reviewer", "approver", "admin"],
  "cases:decide": ["reviewer", "approver", "admin"],
  "cases:approve": ["reviewer", "approver", "admin"],
  "fields:reveal": ["reviewer", "approver", "admin"],
  "audit:read": ["approver", "admin"],
  "audit:verify": ["admin"],
  "audit:export": ["admin"],
  "flags:read": ["viewer", "reviewer", "approver", "admin"],
  "flags:change": ["reviewer", "approver", "admin"],
  "flags:approve": ["approver", "admin"],
  "flags:kill": ["reviewer", "approver", "admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function isPermission(value: string): value is Permission {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

export function can(roles: readonly string[], permission: string): boolean {
  if (!isPermission(permission)) return false;
  const allowed: readonly string[] = PERMISSIONS[permission];
  return roles.some((r) => allowed.includes(r));
}

// IdP group claim -> app role. Swap these group names for your Entra/Okta/Google groups.
export const GROUP_ROLE_MAP: Record<string, Role> = {
  "tools-viewers": "viewer",
  "tools-reviewers": "reviewer",
  "tools-approvers": "approver",
  "tools-admins": "admin",
};

export function rolesFromGroups(groups: readonly string[]): Role[] {
  const roles = new Set<Role>();
  for (const g of groups) {
    const role = GROUP_ROLE_MAP[g];
    if (role) roles.add(role);
  }
  return [...roles];
}

// Plain-language names used in denial messages.
export const PERMISSION_LABELS: Record<Permission, string> = {
  "session:read": "view this page",
  "cases:read": "view cases",
  "cases:decide": "reject or escalate cases",
  "cases:approve": "approve cases",
  "fields:reveal": "reveal masked fields",
  "audit:read": "view the audit log",
  "audit:verify": "verify the audit chain",
  "audit:export": "export the audit log",
  "flags:read": "view feature flags",
  "flags:change": "change feature flags",
  "flags:approve": "approve production flag changes",
  "flags:kill": "use the kill switch",
};

export function deniedMessage(roles: readonly string[], permission: Permission): string {
  const allowed = PERMISSIONS[permission].join(", ");
  return `Not allowed: your role (${roles.join(", ") || "none"}) cannot ${PERMISSION_LABELS[permission]}. Allowed roles: ${allowed}. This attempt was recorded in the audit log.`;
}

// The only routes and pages reachable without a role. Adding to these is a reviewable change.
export const PUBLIC_ROUTES = ["api/auth/login", "api/auth/callback", "api/auth/logout", "dev-idp/authorize/approve"];
export const PUBLIC_PAGES = ["login", "forbidden", "dev-idp/authorize"];

// Reveals of masked fields allowed per user per window.
export const REVEAL_RATE_LIMIT = { max: 10, windowMs: 60_000 };

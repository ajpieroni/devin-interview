import { notFound } from "next/navigation";
import { DEV_USERS, IDP } from "@/config/auth";
import { rolesFromGroups } from "@/config/policy";

// Public page: the local dev IdP's account picker. Disabled unless IDP=dev.
export default async function DevIdpAuthorize({ searchParams }: { searchParams: Promise<{ state?: string; redirect_uri?: string }> }) {
  if (IDP !== "dev") notFound();
  const { state = "", redirect_uri = "" } = await searchParams;
  return (
    <div className="auth-card">
      <div className="brand auth-brand"><span className="logo">N</span>Company SSO</div>
      <h1>Choose an account</h1>
      <p className="muted">Demo directory. In production this is your Entra ID, Okta or Google sign-in.</p>
      <div className="accounts">
        {DEV_USERS.map((u) => (
          <a key={u.sub} className="account" href={`/dev-idp/authorize/approve?${new URLSearchParams({ sub: u.sub, state, redirect_uri })}`}>
            <span className="avatar">{u.name.split(" ").map((p) => p[0]).join("")}</span>
            <span className="account-text">
              <span className="me-name">{u.name}</span>
              <span className="muted">{u.email}</span>
            </span>
            <span className="badge">{rolesFromGroups(u.groups).join(", ")}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

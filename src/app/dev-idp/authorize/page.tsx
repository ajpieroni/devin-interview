import { notFound } from "next/navigation";
import { DEV_USERS, IDP } from "@/config/auth";
import { rolesFromGroups } from "@/config/policy";

// Public page: the local dev IdP's sign-in screen. Disabled unless IDP=dev.
export default async function DevIdpAuthorize({ searchParams }: { searchParams: Promise<{ state?: string; redirect_uri?: string }> }) {
  if (IDP !== "dev") notFound();
  const { state = "", redirect_uri = "" } = await searchParams;
  return (
    <div className="card" style={{ maxWidth: 520, margin: "60px auto" }}>
      <h1>Dev IdP</h1>
      <p className="muted">Stand-in for Entra ID / Okta / Google. Pick a seeded user.</p>
      <table>
        <thead>
          <tr><th>User</th><th>IdP groups</th><th>App roles</th><th /></tr>
        </thead>
        <tbody>
          {DEV_USERS.map((u) => (
            <tr key={u.sub}>
              <td>{u.name}<div className="muted">{u.email}</div></td>
              <td className="mono">{u.groups.join(", ")}</td>
              <td>{rolesFromGroups(u.groups).join(", ")}</td>
              <td>
                <a href={`/dev-idp/authorize/approve?${new URLSearchParams({ sub: u.sub, state, redirect_uri })}`}>Sign in</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

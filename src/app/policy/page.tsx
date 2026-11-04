import { requirePage } from "@/core/authz";
import { scanRoutePolicies } from "@/core/route-policy";
import { Notice } from "@/components/ui";

export default async function PolicyPage() {
  await requirePage("session:read", "/policy");
  const routes = scanRoutePolicies();
  const failing = routes.filter((r) => !r.ok);
  return (
    <>
      <h1>Policy</h1>
      <p className="muted">Read-only. Every route and page with the roles allowed to call it, from a scan of <code>src/app</code>. Roles are defined in <code>src/config/policy.ts</code>.</p>
      {failing.length === 0 ? (
        <Notice tone="ok">Default-deny check passed: all {routes.length} routes and pages declare a policy.</Notice>
      ) : (
        <Notice tone="bad">Default-deny check failed: {failing.length} of {routes.length} routes have no valid policy and are refused.</Notice>
      )}
      <table>
        <thead>
          <tr><th>Path</th><th>Kind</th><th>Method</th><th>Permission</th><th>Allowed roles</th><th>Check</th></tr>
        </thead>
        <tbody>
          {routes.map((r) => (
            <tr key={`${r.method} ${r.path}`}>
              <td className="mono">{r.path}</td>
              <td>{r.kind}</td>
              <td className="mono">{r.method}</td>
              <td className="mono">{r.policy ?? "—"}</td>
              <td>{r.roles.join(", ") || "—"}</td>
              <td>{r.ok ? <span className="badge ok">pass</span> : <span className="badge bad">{r.problem}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

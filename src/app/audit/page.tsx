import Link from "next/link";
import { can } from "@/config/policy";
import { requirePage } from "@/core/authz";
import { listAudit } from "@/core/audit-query";
import { VerifyAudit } from "@/components/VerifyAudit";

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePage("audit:read", "/audit");
  const raw = await searchParams;
  const sp = new URLSearchParams(Object.entries(raw).filter((e): e is [string, string] => !!e[1]));
  const result = await listAudit(sp);
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const pageHref = (p: number) => {
    const next = new URLSearchParams(sp);
    next.set("page", String(p));
    return `/audit?${next}`;
  };
  return (
    <>
      <h1>Audit log</h1>
      <div className="actions" style={{ marginBottom: 12 }}>
        {can(user.roles, "audit:verify") && <VerifyAudit />}
        {can(user.roles, "audit:export") && <a href="/api/audit/export">Export CSV</a>}
        <span className="muted">{result.total} entries · newest first</span>
      </div>
      <table>
        <thead>
          <tr><th>#</th><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Before</th><th>After</th><th>Request</th><th>Hash</th></tr>
        </thead>
        <tbody>
          {result.items.map((e) => (
            <tr key={e.id}>
              <td>{e.id}</td>
              <td>{e.createdAt.toLocaleString()}</td>
              <td className="mono">{e.actorId}</td>
              <td>{e.action}</td>
              <td className="mono">
                {e.entityType === "case" ? <Link href={`/cases/${e.entityId}`}>case:{e.entityId.slice(-8)}</Link> : `${e.entityType}:${e.entityId}`}
              </td>
              <td className="mono">{e.before}</td>
              <td className="mono">{e.after}</td>
              <td className="mono">{e.requestId.slice(0, 8)}</td>
              <td className="mono" title={`prev ${e.prevHash}`}>{e.hash.slice(0, 10)}…</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pager">
        {result.page > 1 && <Link href={pageHref(result.page - 1)}>← Newer</Link>}
        {result.page < pages && <Link href={pageHref(result.page + 1)}>Older →</Link>}
      </div>
    </>
  );
}

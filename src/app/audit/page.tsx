import Link from "next/link";
import { can } from "@/config/policy";
import { requirePage } from "@/core/authz";
import { auditFilterOptions, listAudit } from "@/core/audit-query";
import { HttpError } from "@/core/http";
import { timed } from "@/core/timing";
import { parseJson } from "@/core/json";
import { VerifyAudit } from "@/components/VerifyAudit";
import { EmptyState, ErrorState, ListFooter } from "@/components/ui";

const ENTITY_TYPES = ["case", "user", "route", "page"];

function pretty(s: string | null) {
  if (!s) return "—";
  return JSON.stringify(parseJson(s, s), null, 2);
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePage("audit:read", "/audit");
  const raw = await searchParams;
  const sp = new URLSearchParams(Object.entries(raw).filter((e): e is [string, string] => !!e[1]));
  let result;
  let ms: number;
  try {
    ({ value: result, ms } = await timed(() => listAudit(sp)));
  } catch (err) {
    if (err instanceof HttpError) return <ErrorState>{err.message}</ErrorState>;
    throw err;
  }
  const options = await auditFilterOptions();
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
      </div>
      <form className="filters" method="get">
        <label>Actor
          <select name="actorId" defaultValue={sp.get("actorId") ?? ""}>
            <option value="">All</option>
            {options.actors.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label>Action
          <select name="action" defaultValue={sp.get("action") ?? ""}>
            <option value="">All</option>
            {options.actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label>Entity type
          <select name="entityType" defaultValue={sp.get("entityType") ?? ""}>
            <option value="">All</option>
            {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>Entity id
          <input name="entityId" defaultValue={sp.get("entityId") ?? ""} style={{ width: 160 }} />
        </label>
        <button type="submit">Apply</button>
        <Link href="/audit">Clear</Link>
      </form>
      {result.items.length === 0 ? (
        <EmptyState>No audit entries match these filters.</EmptyState>
      ) : (
        <table>
          <thead>
            <tr><th>#</th><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Before / after</th><th>Request</th><th>Hash</th></tr>
          </thead>
          <tbody>
            {result.items.map((e) => (
              <tr key={e.id}>
                <td>{e.id}</td>
                <td>{e.createdAt.toLocaleString()}</td>
                <td className="mono">{e.actorId}</td>
                <td>{e.action}</td>
                <td className="mono">
                  {e.entityType === "case" ? <Link href={`/cases/${e.entityId}`}>case:{e.entityId}</Link> : `${e.entityType}:${e.entityId}`}
                </td>
                <td>
                  <details>
                    <summary>View</summary>
                    <div className="diff">
                      <div><div className="muted">Before</div><pre>{pretty(e.before)}</pre></div>
                      <div><div className="muted">After</div><pre>{pretty(e.after)}</pre></div>
                    </div>
                  </details>
                </td>
                <td className="mono">{e.requestId.slice(0, 8)}</td>
                <td className="mono" title={`prev ${e.prevHash}`}>{e.hash.slice(0, 10)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="pager">
        {result.page > 1 && <Link href={pageHref(result.page - 1)}>← Newer</Link>}
        <span className="muted">Page {result.page} of {pages}</span>
        {result.page < pages && <Link href={pageHref(result.page + 1)}>Older →</Link>}
      </div>
      <ListFooter shown={result.items.length} total={result.total} ms={ms} />
    </>
  );
}

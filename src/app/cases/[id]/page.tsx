import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/config/policy";
import { requirePage } from "@/core/authz";
import { getCase } from "@/core/cases";
import { prisma } from "@/core/db";
import { money } from "@/core/format";
import { HttpError } from "@/core/http";
import { CaseActions } from "@/components/CaseActions";
import { RevealField } from "@/components/RevealField";

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePage("cases:read", `/cases/${id}`);
  let c;
  try {
    c = await getCase(id);
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) notFound();
    throw err;
  }
  const history = can(user.roles, "audit:read")
    ? await prisma.auditEntry.findMany({ where: { entityType: "case", entityId: id }, orderBy: { id: "asc" } })
    : null;

  return (
    <>
      <p><Link href="/cases">← Queue</Link></p>
      <h1>{c.type.toUpperCase()} case <span className="mono">{c.id}</span></h1>
      <div className="card grid">
        <span className="muted">Status</span><span>{c.status}</span>
        <span className="muted">Risk</span><span><span className={`badge ${c.risk}`}>{c.risk}</span></span>
        <span className="muted">Amount</span><span>{c.amountCents ? money(c.amountCents) : "—"}</span>
        <span className="muted">Requester</span><span className="mono">{c.requesterId}</span>
        <span className="muted">Approvals</span>
        <span>{c.approvals.length} of {c.requiredApprovals} required {c.approvals.length > 0 && <span className="muted">({c.approvals.map((a) => a.userId).join(", ")})</span>}</span>
        <span className="muted">Created</span><span>{new Date(c.createdAt).toLocaleString()}</span>
        {Object.entries(c.data).map(([k, v]) => (
          <span key={k} style={{ display: "contents" }}>
            <span className="muted">{k}</span><span>{String(v)}</span>
          </span>
        ))}
        {Object.keys(c.masked).map((field) => (
          <span key={field} style={{ display: "contents" }}>
            <span className="muted">{field}</span>
            <RevealField caseId={c.id} field={field} canReveal={can(user.roles, "fields:reveal")} />
          </span>
        ))}
      </div>
      <CaseActions
        caseId={c.id}
        status={c.status}
        canApprove={can(user.roles, "cases:approve")}
        canDecide={can(user.roles, "cases:decide")}
      />
      {history && (
        <>
          <h2>History (from audit log)</h2>
          <table>
            <thead><tr><th>#</th><th>Time</th><th>Actor</th><th>Action</th><th>Before</th><th>After</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{h.id}</td>
                  <td>{h.createdAt.toLocaleString()}</td>
                  <td className="mono">{h.actorId}</td>
                  <td>{h.action}</td>
                  <td className="mono">{h.before}</td>
                  <td className="mono">{h.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}

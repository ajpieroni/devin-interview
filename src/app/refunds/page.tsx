import Link from "next/link";
import { oldestPendingRefunds, REFUND_LIMIT_CENTS, refundQuery, refundSummary } from "@/apps/refunds";
import { requirePage } from "@/core/authz";
import { CASE_STATUSES, listCases } from "@/core/cases";
import { ageDays, money } from "@/core/format";
import { HttpError } from "@/core/http";
import { timed } from "@/core/timing";
import { EmptyState, ErrorState, ListFooter } from "@/components/ui";

export default async function RefundsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePage("cases:read", "/refunds");
  const raw = await searchParams;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) for (const one of [v].flat()) if (one) sp.append(k, one);

  let result;
  let ms: number;
  try {
    ({ value: result, ms } = await timed(() => listCases(refundQuery(sp))));
  } catch (err) {
    if (err instanceof HttpError) return <ErrorState>{err.message}</ErrorState>;
    throw err;
  }
  const [summary, oldest] = await Promise.all([refundSummary(), oldestPendingRefunds()]);
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const pageHref = (p: number) => {
    const next = new URLSearchParams(sp);
    next.set("page", String(p));
    return `/refunds?${next}`;
  };

  return (
    <>
      <h1>Refunds dashboard</h1>
      <p className="muted">
        Refunds up to {money(REFUND_LIMIT_CENTS)} need one approver; above it, a second, distinct approver. The requester can never approve. See <Link href="/rules">Rules</Link>.
      </p>
      <div className="split">
        <table>
          <thead>
            <tr><th>Status</th><th>Count</th><th>Total</th></tr>
          </thead>
          <tbody>
            {summary.map((s) => (
              <tr key={s.status}>
                <td><Link href={`/refunds?status=${s.status}`}>{s.status}</Link></td>
                <td>{s.count.toLocaleString()}</td>
                <td>{money(s.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table>
          <thead>
            <tr><th colSpan={4}>Oldest pending</th></tr>
          </thead>
          <tbody>
            {oldest.length === 0 && <tr><td colSpan={4} className="muted">Nothing pending.</td></tr>}
            {oldest.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/cases/${c.id}`} className="mono">{c.id}</Link></td>
                <td>{money(c.amountCents)}</td>
                <td>{c.status}</td>
                <td>{ageDays(c.createdAt)}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="filters" method="get" key={sp.toString()}>
        <label>Status
          <select name="status" defaultValue={sp.get("status") ?? ""}>
            <option value="">All</option>
            {CASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Order
          <select name="view" defaultValue={sp.get("view") ?? "oldest"}>
            <option value="oldest">Oldest first</option>
            <option value="newest">Newest first</option>
            <option value="largest">Largest amount first</option>
          </select>
        </label>
        <button type="submit">Apply</button>
        <Link href="/refunds">Clear</Link>
      </form>
      {result.items.length === 0 ? (
        <EmptyState>No refunds match these filters.</EmptyState>
      ) : (
        <table>
          <thead>
            <tr><th>Case</th><th>Customer</th><th>Amount</th><th>Reason</th><th>Requester</th><th>Status</th><th>Approvals</th><th>Age</th></tr>
          </thead>
          <tbody>
            {result.items.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/cases/${c.id}`} className="mono">{c.id}</Link></td>
                <td>{String(c.data.customer ?? "")}</td>
                <td>
                  {money(c.amountCents)} {c.amountCents > REFUND_LIMIT_CENTS && <span className="badge medium">2 approvers</span>}
                </td>
                <td>{String(c.data.reason ?? "")}</td>
                <td className="mono">{c.requesterId}</td>
                <td>{c.status}</td>
                <td>{c.requiredApprovals}</td>
                <td>{ageDays(c.createdAt)}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="pager">
        {result.page > 1 && <Link href={pageHref(result.page - 1)}>← Prev</Link>}
        <span className="muted">Page {result.page} of {pages}</span>
        {result.page < pages && <Link href={pageHref(result.page + 1)}>Next →</Link>}
      </div>
      <ListFooter shown={result.items.length} total={result.total} ms={ms} />
    </>
  );
}

import Link from "next/link";
import { requirePage } from "@/core/authz";
import { CASE_STATUSES, OPEN_STATUSES, RISKS, listCases, parseCaseQuery } from "@/core/cases";
import { ageDays, money } from "@/core/format";
import { HttpError } from "@/core/http";
import { timed } from "@/core/timing";
import { REVIEW_TARGET_DAYS } from "@/config/approval-rules";
import { EmptyState, ErrorState, ListFooter } from "@/components/ui";

export default async function CasesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePage("cases:read", "/cases");
  const raw = await searchParams;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) for (const one of [v].flat()) if (one) sp.append(k, one);

  let result;
  let ms: number;
  try {
    ({ value: result, ms } = await timed(() => listCases(parseCaseQuery(sp))));
  } catch (err) {
    if (err instanceof HttpError) return <ErrorState>{err.message}</ErrorState>;
    throw err;
  }
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const pageHref = (p: number) => {
    const next = new URLSearchParams(sp);
    next.set("page", String(p));
    return `/cases?${next}`;
  };

  return (
    <>
      <h1>Work queue</h1>
      <form className="filters" method="get">
        <label>Type
          <select name="type" defaultValue={sp.get("type") ?? ""}>
            <option value="">All</option>
            <option value="kyc">KYC</option>
            <option value="refund">Refund</option>
          </select>
        </label>
        <label>Status
          <select name="status" defaultValue={sp.get("status") ?? ""}>
            <option value="">All</option>
            {CASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Risk
          <select name="risk" defaultValue={sp.get("risk") ?? ""}>
            <option value="">All</option>
            {RISKS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label>Older than (days)
          <input name="minAgeDays" type="number" min={0} defaultValue={sp.get("minAgeDays") ?? ""} style={{ width: 90 }} />
        </label>
        <label>Sort
          <select name="order" defaultValue={sp.get("order") ?? "asc"}>
            <option value="asc">Oldest first</option>
            <option value="desc">Newest first</option>
          </select>
        </label>
        <button type="submit">Apply</button>
      </form>
      {result.items.length === 0 ? (
        <EmptyState>No cases match these filters.</EmptyState>
      ) : (
      <table>
        <thead>
          <tr><th>Case</th><th>Type</th><th>Status</th><th>Risk</th><th>Amount</th><th>Requester</th><th>Age</th></tr>
        </thead>
        <tbody>
          {result.items.map((c) => (
            <tr key={c.id}>
              <td><Link href={`/cases/${c.id}`} className="mono">{c.id.slice(-8)}</Link></td>
              <td>{c.type}</td>
              <td>{c.status}</td>
              <td><span className={`badge ${c.risk}`}>{c.risk}</span></td>
              <td>{c.amountCents ? money(c.amountCents) : "—"}</td>
              <td className="mono">{c.requesterId}</td>
              <td>
                {ageDays(c.createdAt)}d{" "}
                {OPEN_STATUSES.includes(c.status) && ageDays(c.createdAt) > (REVIEW_TARGET_DAYS[c.type] ?? Infinity) && (
                  <span className="badge high" title={`Review target: ${REVIEW_TARGET_DAYS[c.type]} days`}>overdue</span>
                )}
              </td>
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

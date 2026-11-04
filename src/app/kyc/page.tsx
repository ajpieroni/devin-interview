import Link from "next/link";
import { ageVsTarget, KYC_TARGET_DAYS, kycQuery } from "@/apps/kyc";
import { requirePage } from "@/core/authz";
import { CASE_STATUSES, RISKS, listCases } from "@/core/cases";
import { HttpError } from "@/core/http";
import { timed } from "@/core/timing";
import { EmptyState, ErrorState, ListFooter } from "@/components/ui";

export default async function KycQueuePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePage("cases:read", "/kyc");
  const raw = await searchParams;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) for (const one of [v].flat()) if (one) sp.append(k, one);

  let result;
  let ms: number;
  try {
    ({ value: result, ms } = await timed(() => listCases(kycQuery(sp))));
  } catch (err) {
    if (err instanceof HttpError) return <ErrorState>{err.message}</ErrorState>;
    throw err;
  }
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const pageHref = (p: number) => {
    const next = new URLSearchParams(sp);
    next.set("page", String(p));
    return `/kyc?${next}`;
  };

  return (
    <>
      <h1>KYC review queue</h1>
      <p className="muted">Oldest first. Review target: {KYC_TARGET_DAYS} days.</p>
      <form className="filters" method="get" key={sp.toString()}>
        <label>Status
          <select name="status" defaultValue={sp.get("status") ?? "open"}>
            <option value="open">Open</option>
            <option value="all">All</option>
            {CASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Risk tier
          <select name="risk" defaultValue={sp.get("risk") ?? ""}>
            <option value="">All</option>
            {RISKS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label>Older than (days)
          <input name="minAgeDays" type="number" min={0} defaultValue={sp.get("minAgeDays") ?? ""} style={{ width: 90 }} />
        </label>
        <button type="submit">Apply</button>
        <Link href="/kyc">Clear</Link>
      </form>
      {result.items.length === 0 ? (
        <EmptyState>No KYC cases match these filters.</EmptyState>
      ) : (
        <table>
          <thead>
            <tr><th>Case</th><th>Applicant</th><th>Country</th><th>Document</th><th>Risk</th><th>Status</th><th>Age vs target</th></tr>
          </thead>
          <tbody>
            {result.items.map((c) => {
              const a = ageVsTarget(c.createdAt, c.status);
              return (
                <tr key={c.id}>
                  <td><Link href={`/cases/${c.id}`} className="mono">{c.id}</Link></td>
                  <td>{String(c.data.applicantName ?? "")}</td>
                  <td>{String(c.data.country ?? "")}</td>
                  <td>{String(c.data.documentType ?? "")}</td>
                  <td><span className={`badge ${c.risk}`}>{c.risk}</span></td>
                  <td>{c.status}</td>
                  <td>
                    {a.age}d / {a.target}d{" "}
                    {a.overdue ? <span className="badge high">overdue</span> : a.daysLeft >= 0 && <span className="muted">({a.daysLeft}d left)</span>}
                  </td>
                </tr>
              );
            })}
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

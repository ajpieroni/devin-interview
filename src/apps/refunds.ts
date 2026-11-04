import { APPROVAL_RULES } from "@/config/approval-rules";
import { CASE_STATUSES, parseCaseQuery, toPublicCase, type CaseQuery } from "@/core/cases";
import { prisma } from "@/core/db";

// Refunds dashboard: a thin view over the core case queue plus two aggregate queries.
export const REFUND_LIMIT_CENTS = APPROVAL_RULES.refund.singleApproverLimitCents ?? 0;
const PENDING = ["pending", "awaiting_second_approval"];

// view=oldest (default) | newest | largest
export function refundQuery(input: URLSearchParams): CaseQuery {
  const sp = new URLSearchParams(input);
  const view = sp.get("view") || "oldest";
  sp.delete("view");
  sp.set("type", "refund");
  sp.set("sort", view === "largest" ? "amountCents" : "createdAt");
  sp.set("order", view === "oldest" ? "asc" : "desc");
  return parseCaseQuery(sp);
}

// Counts and totals by status, computed in the database.
export async function refundSummary() {
  const groups = await prisma.case.groupBy({
    by: ["status"],
    where: { type: "refund" },
    _count: { _all: true },
    _sum: { amountCents: true },
  });
  return CASE_STATUSES.map((status) => {
    const g = groups.find((x) => x.status === status);
    return { status, count: g?._count._all ?? 0, totalCents: g?._sum.amountCents ?? 0 };
  });
}

export async function oldestPendingRefunds(take = 5) {
  const rows = await prisma.case.findMany({
    where: { type: "refund", status: { in: PENDING } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take,
  });
  return rows.map((r) => toPublicCase(r));
}

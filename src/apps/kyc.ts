import { REVIEW_TARGET_DAYS } from "@/config/approval-rules";
import { OPEN_STATUSES, parseCaseQuery, type CaseQuery } from "@/core/cases";
import { ageDays } from "@/core/format";

// KYC review queue: a thin view over the core case queue.
export const KYC_TARGET_DAYS = REVIEW_TARGET_DAYS.kyc;

// status=open (default) means every open status; status=all means no filter.
export function kycQuery(input: URLSearchParams): CaseQuery {
  const sp = new URLSearchParams(input);
  const status = sp.get("status") || "open";
  sp.delete("status");
  if (status === "open") for (const s of OPEN_STATUSES) sp.append("status", s);
  else if (status !== "all") sp.append("status", status);
  sp.set("type", "kyc");
  sp.set("sort", "createdAt");
  sp.set("order", "asc");
  return parseCaseQuery(sp);
}

export function ageVsTarget(createdAt: string, status: string, now = Date.now()) {
  const age = ageDays(createdAt, now);
  const open = OPEN_STATUSES.includes(status);
  return { age, target: KYC_TARGET_DAYS, overdue: open && age > KYC_TARGET_DAYS, daysLeft: KYC_TARGET_DAYS - age };
}

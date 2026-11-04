// Maker-checker rules. A compliance owner should be able to read this file
// without reading app code.

export type Risk = "low" | "medium" | "high";

export interface ApprovalRule {
  // Amounts strictly above this (in cents) need a second, distinct approver.
  singleApproverLimitCents?: number;
  // Cases at these risk tiers need a second, distinct approver.
  secondApproverRisks?: Risk[];
}

export const APPROVAL_RULES: Record<string, ApprovalRule> = {
  refund: { singleApproverLimitCents: 5_000_00 },
  kyc: { secondApproverRisks: ["high"] },
};

export const DEFAULT_RULE: ApprovalRule = {};

// The requester of an item can never approve it. This is not configurable.
export const REQUESTER_CAN_APPROVE = false as const;

export function requiredApprovals(c: { type: string; amountCents: number; risk: string }): number {
  const rule = APPROVAL_RULES[c.type] ?? DEFAULT_RULE;
  if (rule.singleApproverLimitCents !== undefined && c.amountCents > rule.singleApproverLimitCents) return 2;
  if (rule.secondApproverRisks?.includes(c.risk as Risk)) return 2;
  return 1;
}

// Assumed review targets in days. Open cases older than this show as overdue.
export const REVIEW_TARGET_DAYS: Record<string, number> = { kyc: 7, refund: 7 };

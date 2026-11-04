import { requiredApprovals } from "@/config/approval-rules";
import type { SessionUser } from "./auth/session";
import { appendAudit, auditedTransaction, writeAudit } from "./audit";
import { OPEN_STATUSES, MASK } from "./cases";
import { prisma } from "./db";
import { HttpError } from "./http";
import { parseJson } from "./json";

type Actor = Pick<SessionUser, "id">;

// Approve with maker-checker: the requester can never approve, and items over
// the configured limit need a second, distinct approver. Decision and audit
// entry commit in one transaction.
export async function approveCase(id: string, actor: Actor, requestId: string) {
  const result = await auditedTransaction(async (tx) => {
    const c = await tx.case.findUnique({ where: { id }, include: { approvals: true } });
    if (!c) throw new HttpError(404, "case not found");
    if (!OPEN_STATUSES.includes(c.status)) throw new HttpError(409, `case is already ${c.status}`);
    if (c.requesterId === actor.id) return { refused: "requester cannot approve their own item", status: c.status } as const;
    if (c.approvals.some((a) => a.userId === actor.id)) {
      return { refused: "already approved by this user; a second, distinct approver is required", status: c.status } as const;
    }
    const required = requiredApprovals(c);
    const count = c.approvals.length + 1;
    const status = count >= required ? "approved" : "awaiting_second_approval";
    await tx.approval.create({ data: { caseId: id, userId: actor.id } });
    const updated = await tx.case.update({
      where: { id },
      data: { status, decidedAt: status === "approved" ? new Date() : null },
    });
    await appendAudit(tx, {
      actorId: actor.id,
      action: "case.approve",
      entityType: "case",
      entityId: id,
      before: { status: c.status, approvals: c.approvals.length, amountCents: c.amountCents },
      after: { status, approvals: count, required, amountCents: updated.amountCents },
      requestId,
    });
    return { status } as const;
  });
  if ("refused" in result) {
    await writeAudit({
      actorId: actor.id,
      action: "case.approve.refused",
      entityType: "case",
      entityId: id,
      before: { status: result.status },
      after: { reason: result.refused },
      requestId,
    });
    throw new HttpError(403, result.refused ?? "refused");
  }
  return result;
}

async function closeWith(id: string, actor: Actor, requestId: string, status: "rejected" | "escalated", reason: string) {
  if (!reason?.trim()) throw new HttpError(400, "a reason is required");
  return auditedTransaction(async (tx) => {
    const c = await tx.case.findUnique({ where: { id } });
    if (!c) throw new HttpError(404, "case not found");
    if (!OPEN_STATUSES.includes(c.status)) throw new HttpError(409, `case is already ${c.status}`);
    if (status === "escalated" && c.status === "escalated") throw new HttpError(409, "case is already escalated");
    await tx.case.update({ where: { id }, data: { status, decidedAt: status === "rejected" ? new Date() : null } });
    await appendAudit(tx, {
      actorId: actor.id,
      action: status === "rejected" ? "case.reject" : "case.escalate",
      entityType: "case",
      entityId: id,
      before: { status: c.status, amountCents: c.amountCents },
      after: { status, reason: reason.trim(), amountCents: c.amountCents },
      requestId,
    });
    return { status };
  });
}

export const rejectCase = (id: string, actor: Actor, requestId: string, reason: string) =>
  closeWith(id, actor, requestId, "rejected", reason);
export const escalateCase = (id: string, actor: Actor, requestId: string, reason: string) =>
  closeWith(id, actor, requestId, "escalated", reason);

// Reveals one masked field. The audit entry records which field, never its value.
export async function revealField(id: string, field: string, actor: Actor, requestId: string) {
  const c = await prisma.case.findUnique({ where: { id }, select: { sensitive: true } });
  if (!c) throw new HttpError(404, "case not found");
  const sensitive = parseJson<Record<string, unknown>>(c.sensitive, {});
  if (!Object.prototype.hasOwnProperty.call(sensitive, field)) throw new HttpError(404, "field not found");
  await writeAudit({
    actorId: actor.id,
    action: "field.reveal",
    entityType: "case",
    entityId: id,
    before: { [field]: MASK },
    after: { field },
    requestId,
  });
  return { field, value: sensitive[field] };
}

import { z } from "zod";
import { FLAG_RULES, REQUESTER_CAN_APPROVE } from "@/config/approval-rules";
import type { SessionUser } from "@/core/auth/session";
import { appendAudit, auditedTransaction } from "@/core/audit";
import { prisma, type Tx } from "@/core/db";
import { HttpError } from "@/core/http";
import { parseJson } from "@/core/json";

// Feature-flag admin: flags, per-environment values with plan-tier targeting,
// maker-checker on protected environments, and history from the audit log.

export type Env = (typeof FLAG_RULES.environments)[number];
export type Plan = (typeof FLAG_RULES.planTiers)[number];
export interface EnvState {
  on: boolean;
  plans: Plan[];
}
type Actor = Pick<SessionUser, "id">;

export const changeBody = z
  .object({
    env: z.enum(FLAG_RULES.environments),
    on: z.boolean(),
    plans: z.array(z.enum(FLAG_RULES.planTiers)).max(FLAG_RULES.planTiers.length).default([]),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();
export type ChangeInput = z.infer<typeof changeBody>;

export function isProtected(env: string) {
  return FLAG_RULES.protectedEnvironments.includes(env);
}

export function envStates(envsJson: string): Record<Env, EnvState> {
  const raw = parseJson<Partial<Record<Env, EnvState>>>(envsJson, {});
  return Object.fromEntries(FLAG_RULES.environments.map((e) => [e, raw[e] ?? { on: false, plans: [] }])) as Record<Env, EnvState>;
}

// Whether a user on `plan` sees the flag in an environment.
export function evaluate(state: EnvState, plan: Plan): boolean {
  return state.on && (state.plans.length === 0 || state.plans.includes(plan));
}

const normalize = (s: EnvState): EnvState => ({ on: s.on, plans: [...new Set(s.plans)].sort() as Plan[] });
const same = (a: EnvState, b: EnvState) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));

export async function listFlags() {
  const flags = await prisma.flag.findMany({ orderBy: { key: "asc" }, include: { changes: { where: { status: "pending" } } } });
  return flags.map((f) => ({ key: f.key, description: f.description, envs: envStates(f.envs), pending: f.changes.length }));
}

export async function getFlag(key: string) {
  const flag = await prisma.flag.findUnique({ where: { key } });
  if (!flag) throw new HttpError(404, "flag not found");
  const [pending, history] = await Promise.all([
    prisma.flagChange.findMany({ where: { flagKey: key, status: "pending" }, orderBy: { createdAt: "asc" } }),
    prisma.auditEntry.findMany({ where: { entityType: "flag", entityId: key }, orderBy: { id: "desc" }, take: 100 }),
  ]);
  return {
    key: flag.key,
    description: flag.description,
    envs: envStates(flag.envs),
    pending: pending.map((c) => ({ id: c.id, env: c.env, on: c.on, plans: parseJson<Plan[]>(c.plans, []), requesterId: c.requesterId, reason: c.reason, createdAt: c.createdAt.toISOString() })),
    history,
  };
}

async function loadFlag(tx: Tx, key: string) {
  const flag = await tx.flag.findUnique({ where: { key } });
  if (!flag) throw new HttpError(404, "flag not found");
  return { flag, envs: envStates(flag.envs) };
}

// Non-protected environments change immediately; protected ones get a pending
// change that a second, distinct person must approve.
export async function requestChange(key: string, input: ChangeInput, actor: Actor, requestId: string) {
  return auditedTransaction(async (tx) => {
    const { envs } = await loadFlag(tx, key);
    const before = envs[input.env];
    const after = normalize({ on: input.on, plans: input.plans });
    if (same(before, after)) throw new HttpError(409, `no change: ${input.env} already has this value`);
    if (isProtected(input.env)) {
      const open = await tx.flagChange.findFirst({ where: { flagKey: key, env: input.env, status: "pending" } });
      if (open) throw new HttpError(409, `a ${input.env} change is already waiting for approval`);
      const change = await tx.flagChange.create({
        data: { flagKey: key, env: input.env, on: after.on, plans: JSON.stringify(after.plans), requesterId: actor.id, reason: input.reason },
      });
      await appendAudit(tx, {
        actorId: actor.id,
        action: "flag.change.requested",
        entityType: "flag",
        entityId: key,
        before: { env: input.env, ...before },
        after: { env: input.env, ...after, changeId: change.id, reason: input.reason ?? null },
        requestId,
      });
      return { status: "pending" as const, changeId: change.id };
    }
    await tx.flag.update({ where: { key }, data: { envs: JSON.stringify({ ...envs, [input.env]: after }) } });
    await tx.flagChange.create({
      data: { flagKey: key, env: input.env, on: after.on, plans: JSON.stringify(after.plans), requesterId: actor.id, reason: input.reason, status: "applied", decidedAt: new Date() },
    });
    await appendAudit(tx, {
      actorId: actor.id,
      action: "flag.change",
      entityType: "flag",
      entityId: key,
      before: { env: input.env, ...before },
      after: { env: input.env, ...after, reason: input.reason ?? null },
      requestId,
    });
    return { status: "applied" as const };
  });
}

export async function decideChange(changeId: string, decision: "approve" | "reject", actor: Actor, requestId: string, reason?: string) {
  const result = await auditedTransaction(async (tx) => {
    const change = await tx.flagChange.findUnique({ where: { id: changeId } });
    if (!change) throw new HttpError(404, "flag change not found");
    if (change.status !== "pending") throw new HttpError(409, `change is already ${change.status}`);
    const { envs } = await loadFlag(tx, change.flagKey);
    const before = envs[change.env as Env];
    const proposed = { on: change.on, plans: parseJson<Plan[]>(change.plans, []) };
    if (decision === "approve" && change.requesterId === actor.id && !REQUESTER_CAN_APPROVE) {
      const refused = "the requester cannot approve their own flag change; a second, distinct approver is required";
      await appendAudit(tx, {
        actorId: actor.id,
        action: "flag.change.approve.refused",
        entityType: "flag",
        entityId: change.flagKey,
        before: { env: change.env, ...before },
        after: { changeId, reason: refused },
        requestId,
      });
      return { refused };
    }
    if (decision === "approve") {
      await tx.flag.update({ where: { key: change.flagKey }, data: { envs: JSON.stringify({ ...envs, [change.env]: proposed }) } });
    }
    const status = decision === "approve" ? "applied" : "rejected";
    await tx.flagChange.update({ where: { id: changeId }, data: { status, approverId: actor.id, decidedAt: new Date(), ...(reason ? { reason } : {}) } });
    await appendAudit(tx, {
      actorId: actor.id,
      action: decision === "approve" ? "flag.change.approved" : "flag.change.rejected",
      entityType: "flag",
      entityId: change.flagKey,
      before: { env: change.env, ...before },
      after: decision === "approve" ? { env: change.env, ...proposed, changeId, requesterId: change.requesterId } : { changeId, reason },
      requestId,
    });
    return { status };
  });
  if ("refused" in result) throw new HttpError(403, result.refused ?? "refused");
  return result;
}

// One action: every environment off, pending changes cancelled.
export async function killFlag(key: string, actor: Actor, requestId: string, reason: string) {
  return auditedTransaction(async (tx) => {
    const { envs } = await loadFlag(tx, key);
    const off = Object.fromEntries(FLAG_RULES.environments.map((e) => [e, { ...envs[e], on: false }]));
    await tx.flag.update({ where: { key }, data: { envs: JSON.stringify(off) } });
    const cancelled = await tx.flagChange.updateMany({
      where: { flagKey: key, status: "pending" },
      data: { status: "cancelled", approverId: actor.id, decidedAt: new Date() },
    });
    await appendAudit(tx, {
      actorId: actor.id,
      action: "flag.kill",
      entityType: "flag",
      entityId: key,
      before: envs,
      after: { ...off, reason, cancelledPendingChanges: cancelled.count },
      requestId,
    });
    return { status: "killed" as const, cancelledPendingChanges: cancelled.count };
  });
}

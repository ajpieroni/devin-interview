import { createHash } from "node:crypto";
import { prisma, type Tx } from "./db";
import { stableStringify } from "./json";

export const GENESIS_HASH = "0".repeat(64);

export interface AuditInput {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  requestId: string;
}

interface HashFields {
  prevHash: string;
  createdAt: Date;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  before: string | null;
  after: string | null;
  requestId: string;
}

export function computeHash(f: HashFields): string {
  return createHash("sha256")
    .update(
      stableStringify({
        prevHash: f.prevHash,
        createdAt: f.createdAt.toISOString(),
        actorId: f.actorId,
        action: f.action,
        entityType: f.entityType,
        entityId: f.entityId,
        before: f.before,
        after: f.after,
        requestId: f.requestId,
      }),
    )
    .digest("hex");
}

// Appends inside the caller's transaction so a decision and its audit entry
// commit together. prevHash is unique, so two writers racing for the same
// tail cannot both commit; the loser's transaction fails and must retry.
export async function appendAudit(tx: Tx, input: AuditInput) {
  const last = await tx.auditEntry.findFirst({ orderBy: { id: "desc" }, select: { hash: true } });
  const fields: HashFields = {
    prevHash: last?.hash ?? GENESIS_HASH,
    createdAt: new Date(),
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before === undefined ? null : stableStringify(input.before),
    after: input.after === undefined ? null : stableStringify(input.after),
    requestId: input.requestId,
  };
  return tx.auditEntry.create({ data: { ...fields, hash: computeHash(fields) } });
}

export async function writeAudit(input: AuditInput) {
  return auditedTransaction((tx) => appendAudit(tx, input));
}

// SQLite allows one writer at a time, so audited writes are queued in-process.
// The unique prevHash still rejects a forked chain if several processes write.
let queue: Promise<unknown> = Promise.resolve();

export function auditedTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const run = queue.then(() => withRetry(() => prisma.$transaction(fn)));
  queue = run.catch(() => undefined);
  return run;
}

export async function withRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err)) throw err;
    }
  }
  throw lastErr;
}

function isRetryable(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return code === "P2002" || code === "P2034";
}

export interface VerifyResult {
  ok: boolean;
  checked: number;
  brokenAtId?: number;
  reason?: string;
}

// Recomputes the whole chain. Tamper-evident, not tamper-proof: someone with
// write access to the database could rewrite every hash after an edit.
export async function verifyAuditChain(batchSize = 1000): Promise<VerifyResult> {
  let prevHash = GENESIS_HASH;
  let cursor = 0;
  let checked = 0;
  for (;;) {
    const rows = await prisma.auditEntry.findMany({ where: { id: { gt: cursor } }, orderBy: { id: "asc" }, take: batchSize });
    if (rows.length === 0) break;
    for (const row of rows) {
      if (row.prevHash !== prevHash) return { ok: false, checked, brokenAtId: row.id, reason: "prevHash does not match previous entry" };
      if (computeHash(row) !== row.hash) return { ok: false, checked, brokenAtId: row.id, reason: "hash does not match contents" };
      prevHash = row.hash;
      checked++;
    }
    cursor = rows[rows.length - 1].id;
  }
  return { ok: true, checked };
}

const CSV_COLUMNS = ["id", "createdAt", "actorId", "action", "entityType", "entityId", "before", "after", "requestId", "prevHash", "hash"] as const;

export async function exportAuditCsv(): Promise<string> {
  const rows = await prisma.auditEntry.findMany({ orderBy: { id: "asc" } });
  const lines = [CSV_COLUMNS.join(",")];
  for (const r of rows) {
    lines.push(
      CSV_COLUMNS.map((c) => {
        const v = r[c];
        return csvCell(v instanceof Date ? v.toISOString() : v == null ? "" : String(v));
      }).join(","),
    );
  }
  return lines.join("\n") + "\n";
}

function csvCell(s: string): string {
  const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

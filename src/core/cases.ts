import type { Case, Prisma } from "@prisma/client";
import { requiredApprovals } from "@/config/approval-rules";
import { prisma } from "./db";
import { HttpError } from "./http";
import { parseJson } from "./json";

export const CASE_STATUSES = ["pending", "awaiting_second_approval", "approved", "rejected", "escalated"] as const;
export const OPEN_STATUSES: readonly string[] = ["pending", "awaiting_second_approval", "escalated"];
export const RISKS = ["low", "medium", "high"] as const;
const SORTS = ["createdAt", "updatedAt", "amountCents"] as const;
export const MAX_PAGE_SIZE = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface CaseQuery {
  type?: string;
  status: string[];
  risk: string[];
  minAgeDays?: number;
  maxAgeDays?: number;
  assigneeId?: string;
  sort: (typeof SORTS)[number];
  order: "asc" | "desc";
  page: number;
  pageSize: number;
}

export function parseCaseQuery(sp: URLSearchParams): CaseQuery {
  const list = (key: string, allowed: readonly string[]) => {
    const values = sp.getAll(key).flatMap((v) => v.split(",")).filter(Boolean);
    for (const v of values) if (!allowed.includes(v)) throw new HttpError(400, `invalid ${key}: ${v}`);
    return values;
  };
  const int = (key: string, min: number, max: number, fallback?: number) => {
    const raw = sp.get(key);
    if (raw === null || raw === "") return fallback;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, `invalid ${key}`);
    return n;
  };
  const sort = (sp.get("sort") ?? "createdAt") as CaseQuery["sort"];
  if (!SORTS.includes(sort)) throw new HttpError(400, "invalid sort");
  const order = (sp.get("order") ?? "asc") as CaseQuery["order"];
  if (order !== "asc" && order !== "desc") throw new HttpError(400, "invalid order");
  return {
    type: sp.get("type") || undefined,
    status: list("status", CASE_STATUSES),
    risk: list("risk", RISKS),
    minAgeDays: int("minAgeDays", 0, 3650),
    maxAgeDays: int("maxAgeDays", 0, 3650),
    assigneeId: sp.get("assigneeId") || undefined,
    sort,
    order,
    page: int("page", 1, 1_000_000, 1)!,
    pageSize: int("pageSize", 1, MAX_PAGE_SIZE, 25)!,
  };
}

export function buildCaseWhere(q: CaseQuery, now = new Date()): Prisma.CaseWhereInput {
  const createdAt: Prisma.DateTimeFilter = {};
  if (q.minAgeDays !== undefined) createdAt.lte = new Date(now.getTime() - q.minAgeDays * DAY_MS);
  if (q.maxAgeDays !== undefined) createdAt.gte = new Date(now.getTime() - q.maxAgeDays * DAY_MS);
  return {
    ...(q.type ? { type: q.type } : {}),
    ...(q.status.length ? { status: { in: q.status } } : {}),
    ...(q.risk.length ? { risk: { in: q.risk } } : {}),
    ...(q.assigneeId ? { assigneeId: q.assigneeId } : {}),
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
  };
}

// Filtering, sorting and paging all happen in the database; at most
// pageSize rows are ever loaded.
export async function listCases(q: CaseQuery) {
  const where = buildCaseWhere(q);
  const [rows, total] = await Promise.all([
    prisma.case.findMany({
      where,
      orderBy: [{ [q.sort]: q.order }, { id: q.order }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.case.count({ where }),
  ]);
  return { items: rows.map((r) => toPublicCase(r)), total, page: q.page, pageSize: q.pageSize };
}

export const MASK = "••••••";

export function toPublicCase(c: Case, approvals: { userId: string; createdAt: Date }[] = []) {
  const sensitive = parseJson<Record<string, unknown>>(c.sensitive, {});
  return {
    id: c.id,
    type: c.type,
    status: c.status,
    assigneeId: c.assigneeId,
    requesterId: c.requesterId,
    amountCents: c.amountCents,
    risk: c.risk,
    data: parseJson<Record<string, unknown>>(c.data, {}),
    masked: Object.fromEntries(Object.keys(sensitive).map((k) => [k, MASK])),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    decidedAt: c.decidedAt?.toISOString() ?? null,
    requiredApprovals: requiredApprovals(c),
    approvals: approvals.map((a) => ({ userId: a.userId, createdAt: a.createdAt.toISOString() })),
  };
}

export type PublicCase = ReturnType<typeof toPublicCase>;

export async function getCase(id: string) {
  const c = await prisma.case.findUnique({ where: { id }, include: { approvals: { orderBy: { createdAt: "asc" } } } });
  if (!c) throw new HttpError(404, "case not found");
  return toPublicCase(c, c.approvals);
}

import type { Case, Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { requiredApprovals } from "@/config/approval-rules";
import { prisma } from "./db";
import { HttpError } from "./http";
import { parseJson } from "./json";
import { intParam, parse, qp } from "./validation";

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

const caseQuerySchema = z.object({
  type: z.enum(["kyc", "refund"]).optional(),
  status: z.array(z.enum(CASE_STATUSES)),
  risk: z.array(z.enum(RISKS)),
  minAgeDays: intParam(0, 3650).optional(),
  maxAgeDays: intParam(0, 3650).optional(),
  assigneeId: z.string().max(64).optional(),
  sort: z.enum(SORTS).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("asc"),
  page: intParam(1, 1_000_000).default(1),
  pageSize: intParam(1, MAX_PAGE_SIZE).default(25),
});

export function parseCaseQuery(sp: URLSearchParams): CaseQuery {
  const multi = (key: string) => sp.getAll(key).flatMap((v) => v.split(",")).filter(Boolean);
  return parse(caseQuerySchema, {
    type: qp(sp, "type"),
    status: multi("status"),
    risk: multi("risk"),
    minAgeDays: qp(sp, "minAgeDays"),
    maxAgeDays: qp(sp, "maxAgeDays"),
    assigneeId: qp(sp, "assigneeId"),
    sort: qp(sp, "sort"),
    order: qp(sp, "order"),
    page: qp(sp, "page"),
    pageSize: qp(sp, "pageSize"),
  });
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

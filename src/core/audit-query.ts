import { z } from "zod";
import { prisma } from "./db";
import { intParam, parse, qp } from "./validation";

const auditQuerySchema = z.object({
  actorId: z.string().max(64).optional(),
  action: z.string().max(64).optional(),
  entityType: z.string().max(32).optional(),
  entityId: z.string().max(128).optional(),
  page: intParam(1, 1_000_000).default(1),
  pageSize: intParam(1, 200).default(50),
});

export type AuditQuery = z.infer<typeof auditQuerySchema>;

export function parseAuditQuery(sp: URLSearchParams): AuditQuery {
  return parse(auditQuerySchema, {
    actorId: qp(sp, "actorId"),
    action: qp(sp, "action"),
    entityType: qp(sp, "entityType"),
    entityId: qp(sp, "entityId"),
    page: qp(sp, "page"),
    pageSize: qp(sp, "pageSize"),
  });
}

export async function listAudit(sp: URLSearchParams) {
  const q = parseAuditQuery(sp);
  const where = {
    ...(q.actorId ? { actorId: q.actorId } : {}),
    ...(q.action ? { action: q.action } : {}),
    ...(q.entityType ? { entityType: q.entityType } : {}),
    ...(q.entityId ? { entityId: q.entityId } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.auditEntry.findMany({ where, orderBy: { id: "desc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
    prisma.auditEntry.count({ where }),
  ]);
  return { items, total, page: q.page, pageSize: q.pageSize };
}

export async function auditFilterOptions() {
  const [actions, actors] = await Promise.all([
    prisma.auditEntry.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    prisma.auditEntry.findMany({ distinct: ["actorId"], select: { actorId: true }, orderBy: { actorId: "asc" } }),
  ]);
  return { actions: actions.map((a) => a.action), actors: actors.map((a) => a.actorId) };
}

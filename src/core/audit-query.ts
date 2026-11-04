import { prisma } from "./db";
import { HttpError } from "./http";

export async function listAudit(sp: URLSearchParams) {
  const page = Number(sp.get("page") ?? 1);
  const pageSize = Number(sp.get("pageSize") ?? 50);
  if (!Number.isInteger(page) || page < 1) throw new HttpError(400, "invalid page");
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 200) throw new HttpError(400, "invalid pageSize");
  const where = {
    ...(sp.get("entityType") ? { entityType: sp.get("entityType")! } : {}),
    ...(sp.get("entityId") ? { entityId: sp.get("entityId")! } : {}),
    ...(sp.get("action") ? { action: sp.get("action")! } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.auditEntry.findMany({ where, orderBy: { id: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.auditEntry.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

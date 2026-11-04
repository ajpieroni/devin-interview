import { withPolicy } from "@/core/authz";
import { exportAuditCsv } from "@/core/audit";

export const GET = withPolicy("audit:export", async () =>
  new Response(await exportAuditCsv(), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="audit-log.csv"' },
  }),
);

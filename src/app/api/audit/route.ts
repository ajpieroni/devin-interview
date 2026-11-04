import { NextResponse } from "next/server";
import { withPolicy } from "@/core/authz";
import { listAudit } from "@/core/audit-query";

export const GET = withPolicy("audit:read", async (req) => NextResponse.json(await listAudit(req.nextUrl.searchParams)));

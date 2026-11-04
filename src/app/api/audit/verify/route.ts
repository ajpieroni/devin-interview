import { NextResponse } from "next/server";
import { withPolicy } from "@/core/authz";
import { verifyAuditChain } from "@/core/audit";

export const GET = withPolicy("audit:verify", async () => NextResponse.json(await verifyAuditChain()));

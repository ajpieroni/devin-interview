import { NextResponse } from "next/server";
import { withPolicy } from "@/core/authz";
import { getCase } from "@/core/cases";

export const GET = withPolicy("cases:read", async (_req, { params }) => NextResponse.json(await getCase(params.id)));

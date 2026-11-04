import { NextResponse } from "next/server";
import { getFlag } from "@/apps/flags";
import { withPolicy } from "@/core/authz";

export const GET = withPolicy("flags:read", async (_req, { params }) => NextResponse.json(await getFlag(params.key)));

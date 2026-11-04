import { NextResponse } from "next/server";
import { listFlags } from "@/apps/flags";
import { withPolicy } from "@/core/authz";

export const GET = withPolicy("flags:read", async () => NextResponse.json({ items: await listFlags() }));

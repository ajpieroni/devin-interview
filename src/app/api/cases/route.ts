import { NextResponse } from "next/server";
import { withPolicy } from "@/core/authz";
import { listCases, parseCaseQuery } from "@/core/cases";

export const GET = withPolicy("cases:read", async (req) =>
  NextResponse.json(await listCases(parseCaseQuery(req.nextUrl.searchParams))),
);

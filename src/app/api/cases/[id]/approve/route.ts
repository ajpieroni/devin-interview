import { NextResponse } from "next/server";
import { withPolicy } from "@/core/authz";
import { approveCase } from "@/core/decisions";

export const POST = withPolicy("cases:approve", async (_req, { params, user, requestId }) =>
  NextResponse.json(await approveCase(params.id, user, requestId)),
);

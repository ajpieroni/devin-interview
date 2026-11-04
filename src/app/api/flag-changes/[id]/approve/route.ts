import { NextResponse } from "next/server";
import { decideChange } from "@/apps/flags";
import { withPolicy } from "@/core/authz";

export const POST = withPolicy("flags:approve", async (_req, { params, user, requestId }) =>
  NextResponse.json(await decideChange(params.id, "approve", user, requestId)),
);

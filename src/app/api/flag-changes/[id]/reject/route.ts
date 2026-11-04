import { NextResponse } from "next/server";
import { decideChange } from "@/apps/flags";
import { withPolicy } from "@/core/authz";
import { readReason } from "@/core/body";

export const POST = withPolicy("flags:approve", async (req, { params, user, requestId }) =>
  NextResponse.json(await decideChange(params.id, "reject", user, requestId, await readReason(req))),
);

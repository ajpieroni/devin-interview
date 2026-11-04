import { NextResponse } from "next/server";
import { killFlag } from "@/apps/flags";
import { withPolicy } from "@/core/authz";
import { readReason } from "@/core/body";

export const POST = withPolicy("flags:kill", async (req, { params, user, requestId }) =>
  NextResponse.json(await killFlag(params.key, user, requestId, await readReason(req))),
);

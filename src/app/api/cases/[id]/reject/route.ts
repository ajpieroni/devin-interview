import { NextResponse } from "next/server";
import { withPolicy } from "@/core/authz";
import { rejectCase } from "@/core/decisions";
import { readReason } from "@/core/body";

export const POST = withPolicy("cases:decide", async (req, { params, user, requestId }) =>
  NextResponse.json(await rejectCase(params.id, user, requestId, await readReason(req))),
);

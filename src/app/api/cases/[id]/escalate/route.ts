import { NextResponse } from "next/server";
import { withPolicy } from "@/core/authz";
import { escalateCase } from "@/core/decisions";
import { readReason } from "@/core/body";

export const POST = withPolicy("cases:decide", async (req, { params, user, requestId }) =>
  NextResponse.json(await escalateCase(params.id, user, requestId, await readReason(req))),
);

import { NextResponse } from "next/server";
import { changeBody, requestChange } from "@/apps/flags";
import { withPolicy } from "@/core/authz";
import { readJson } from "@/core/body";
import { parse } from "@/core/validation";

export const POST = withPolicy("flags:change", async (req, { params, user, requestId }) =>
  NextResponse.json(await requestChange(params.key, parse(changeBody, await readJson(req)), user, requestId)),
);

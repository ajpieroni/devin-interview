import { NextResponse } from "next/server";
import { withPolicy } from "@/core/authz";
import { readJson } from "@/core/body";
import { revealField } from "@/core/decisions";
import { HttpError } from "@/core/http";

export const POST = withPolicy("fields:reveal", async (req, { params, user, requestId }) => {
  const { field } = await readJson<{ field?: unknown }>(req);
  if (typeof field !== "string" || !field) throw new HttpError(400, "field is required");
  return NextResponse.json(await revealField(params.id, field, user, requestId));
});

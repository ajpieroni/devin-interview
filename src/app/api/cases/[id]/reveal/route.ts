import { NextResponse } from "next/server";
import { REVEAL_RATE_LIMIT } from "@/config/policy";
import { withPolicy } from "@/core/authz";
import { writeAudit } from "@/core/audit";
import { readJson } from "@/core/body";
import { revealField } from "@/core/decisions";
import { rateLimit } from "@/core/rate-limit";
import { parse, revealBody } from "@/core/validation";

export const POST = withPolicy("fields:reveal", async (req, { params, user, requestId }) => {
  const { field } = parse(revealBody, await readJson(req));
  const limit = rateLimit(`reveal:${user.id}`, REVEAL_RATE_LIMIT.max, REVEAL_RATE_LIMIT.windowMs);
  if (!limit.ok) {
    await writeAudit({
      actorId: user.id,
      action: "field.reveal.rate_limited",
      entityType: "case",
      entityId: params.id,
      after: { field, max: REVEAL_RATE_LIMIT.max, windowMs: REVEAL_RATE_LIMIT.windowMs },
      requestId,
    });
    return NextResponse.json(
      { error: `Too many reveals: the limit is ${REVEAL_RATE_LIMIT.max} per minute. Try again in ${limit.retryAfterSec} s. This attempt was recorded in the audit log.` },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } },
    );
  }
  return NextResponse.json(await revealField(params.id, field, user, requestId));
});

import { z } from "zod";
import { HttpError } from "./http";

export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new HttpError(400, `invalid ${issue.path.join(".") || "input"}: ${issue.message}`);
  }
  return result.data;
}

export const intParam = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

export const idParam = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "must be 1-64 letters, digits, - or _");

export const reasonBody = z
  .object({ reason: z.string({ error: "a reason is required" }).trim().min(1, "a reason is required").max(500) })
  .strict();

export const revealBody = z.object({ field: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/, "unknown field") }).strict();

// Reads a query-string value, treating "" as absent.
export function qp(sp: URLSearchParams, key: string): string | undefined {
  const v = sp.get(key);
  return v === null || v === "" ? undefined : v;
}

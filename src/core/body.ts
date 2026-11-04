import { parse, reasonBody } from "./validation";
import { HttpError } from "./http";

export async function readJson<T = unknown>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "invalid JSON body");
  }
}

export async function readReason(req: Request): Promise<string> {
  return parse(reasonBody, await readJson(req)).reason;
}

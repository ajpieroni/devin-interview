import { HttpError } from "./http";

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "invalid JSON body");
  }
}

export async function readReason(req: Request): Promise<string> {
  const { reason } = await readJson<{ reason?: unknown }>(req);
  return typeof reason === "string" ? reason : "";
}

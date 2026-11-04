import { NextResponse } from "next/server";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

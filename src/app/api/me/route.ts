import { NextResponse } from "next/server";
import { withPolicy } from "@/core/authz";

export const GET = withPolicy("session:read", async (_req, { user }) => NextResponse.json({ user }));

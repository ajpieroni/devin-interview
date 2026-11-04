import { NextResponse, type NextRequest } from "next/server";
import { IDP } from "@/config/auth";
import { publicRoute } from "@/core/authz";
import { issueDevCode } from "@/core/auth/dev-idp";
import { callbackUrl } from "@/core/auth/urls";
import { json } from "@/core/http";

// Part of the local dev IdP. Disabled unless IDP=dev.
export const GET = publicRoute(async (req: NextRequest) => {
  if (IDP !== "dev") return json(404, { error: "not found" });
  const sp = req.nextUrl.searchParams;
  const state = sp.get("state") ?? "";
  if (sp.get("redirect_uri") !== callbackUrl(req)) return json(400, { error: "invalid redirect_uri" });
  let code: string;
  try {
    code = await issueDevCode(sp.get("sub") ?? "", state);
  } catch {
    return json(400, { error: "unknown user" });
  }
  return NextResponse.redirect(new URL(`/api/auth/callback?${new URLSearchParams({ code, state })}`, req.nextUrl.origin));
});

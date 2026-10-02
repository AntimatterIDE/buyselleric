import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/admin-auth";
import { exchangeGoogleCode, verifyGoogleOAuthState } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const jar = await cookies();
  const url = new URL(request.url);
  if (!verifyAdminSession(jar.get(ADMIN_COOKIE_NAME)?.value)) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const error = url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(new URL("/admin/calendar?google=denied", request.url));
  }

  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  if (!code || !verifyGoogleOAuthState(state)) {
    return NextResponse.redirect(new URL("/admin/calendar?google=invalid", request.url));
  }

  try {
    await exchangeGoogleCode(code);
  } catch (err) {
    console.error("[google-calendar] connect", err);
    return NextResponse.redirect(new URL("/admin/calendar?google=failed", request.url));
  }

  return NextResponse.redirect(new URL("/admin/calendar?google=connected", request.url));
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/admin-auth";
import { googleAuthUrl, googleCalendarConfigured, sealGoogleOAuthState } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const jar = await cookies();
  if (!verifyAdminSession(jar.get(ADMIN_COOKIE_NAME)?.value)) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  if (!googleCalendarConfigured()) {
    return NextResponse.redirect(new URL("/admin/calendar?google=missing", request.url));
  }
  const url = googleAuthUrl(sealGoogleOAuthState());
  return NextResponse.redirect(url);
}

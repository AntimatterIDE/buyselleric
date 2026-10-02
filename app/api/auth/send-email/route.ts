import { sendAuthHookEmail, verifyAuthHook, type AuthHookPayload } from "@/lib/auth-hook";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  if (!verifyAuthHook(rawBody, request.headers)) {
    return NextResponse.json({ error: { http_code: 401, message: "Invalid signature." } }, { status: 401 });
  }

  let payload: AuthHookPayload;
  try {
    payload = JSON.parse(rawBody) as AuthHookPayload;
  } catch {
    return NextResponse.json({ error: { http_code: 400, message: "Invalid payload." } }, { status: 400 });
  }

  const sent = await sendAuthHookEmail(payload);
  if (!sent) {
    return NextResponse.json({ error: { http_code: 500, message: "Could not send email." } }, { status: 500 });
  }
  return NextResponse.json({});
}

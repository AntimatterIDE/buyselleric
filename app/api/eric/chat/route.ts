import { NextResponse } from "next/server";
import { handleEricMessage } from "@/lib/eric/run-chat";
import { BuyerSchemaError } from "@/lib/buyer/data";
import { getBuyer } from "@/lib/buyer/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const buyer = await getBuyer();
  if (!buyer) {
    return NextResponse.json({ ok: false, message: "Log in to talk to Eric." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const message =
    typeof body === "object" && body && "message" in body
      ? String((body as { message?: unknown }).message ?? "")
      : "";

  try {
    const reply = await handleEricMessage(buyer.supabase, buyer.user, message);
    return NextResponse.json({ ok: true, message: reply });
  } catch (err) {
    if (err instanceof BuyerSchemaError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: 503 });
    }
    console.error("[eric-chat]", err);
    const text = err instanceof Error ? err.message : "Eric could not answer just then.";
    return NextResponse.json({ ok: false, message: text }, { status: 500 });
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { BuyerSchemaError, createAppointmentRequest } from "@/lib/buyer/data";
import { wallTimeInZoneToUtc } from "@/lib/buyer/time";
import { getBuyer } from "@/lib/buyer/session";
import type { AppointmentType } from "@/lib/buyer/types";

export type BookingFormState = { ok: true; message: string } | { ok: false; message: string } | null;

const TYPES = new Set<AppointmentType>(["virtual_call", "appointment", "in_person_showing"]);

export async function requestAppointment(
  _prev: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const buyer = await getBuyer();
  if (!buyer) return { ok: false, message: "Create an account before booking time with Eric." };

  const typeRaw = String(formData.get("type") ?? "");
  if (!TYPES.has(typeRaw as AppointmentType)) {
    return { ok: false, message: "Pick a call, an appointment, or a showing." };
  }
  const type = typeRaw as AppointmentType;
  const when = String(formData.get("starts_at") ?? "").trim();
  const startsAt = wallTimeInZoneToUtc(when);
  if (!startsAt) return { ok: false, message: "Pick a date and time." };

  const listingSourceRaw = String(formData.get("listing_source") ?? "");
  const listingSource = listingSourceRaw === "mls" || listingSourceRaw === "manual" ? listingSourceRaw : "";

  try {
    await createAppointmentRequest(buyer.supabase, buyer.user.id, {
      type,
      startsAt,
      listingSource,
      listingKey: String(formData.get("listing_key") ?? ""),
      listingTitle: String(formData.get("listing_title") ?? ""),
      listingAddress: String(formData.get("listing_address") ?? ""),
      listingPath: String(formData.get("listing_path") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    });
  } catch (err) {
    if (err instanceof BuyerSchemaError) return { ok: false, message: err.message };
    return { ok: false, message: err instanceof Error ? err.message : "Could not send that request." };
  }

  revalidatePath("/account");
  revalidatePath("/admin/calendar");
  return {
    ok: true,
    message: "Request sent. Eric will confirm it before it is on the calendar.",
  };
}

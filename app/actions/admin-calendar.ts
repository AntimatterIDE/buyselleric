"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/admin-auth";
import { APPOINTMENT_MINUTES, type AppointmentRow, type AppointmentType } from "@/lib/buyer/types";
import { normalizeWindows, wallTimeInZoneToUtc } from "@/lib/buyer/time";
import {
  createGoogleEvent,
  deleteGoogleEvent,
  disconnectGoogleCalendar,
  updateGoogleEvent,
  type CalendarEventInput,
} from "@/lib/google-calendar";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type CalendarActionResult = { ok: boolean; message: string };

async function requireAdmin(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminSession(token)) throw new Error("Unauthorized");
}

type AppointmentWithBuyer = AppointmentRow & {
  profiles: {
    full_name: string;
    email: string;
    phone: string;
    wishes: string;
  } | null;
};

async function loadAppointment(id: string): Promise<AppointmentWithBuyer | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("appointments")
    .select("*, profiles(full_name, email, phone, wishes)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as AppointmentWithBuyer;
}

function eventInput(row: AppointmentWithBuyer): CalendarEventInput {
  const profile = row.profiles;
  return {
    appointmentId: row.id,
    type: row.type,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    buyerName: profile?.full_name ?? "",
    buyerEmail: profile?.email ?? "",
    buyerPhone: profile?.phone ?? "",
    wishes: profile?.wishes ?? "",
    listingTitle: row.listing_title,
    listingAddress: row.listing_address,
    listingPath: row.listing_path,
    notes: row.notes,
  };
}

export async function confirmAppointment(id: string): Promise<CalendarActionResult> {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Supabase admin is not configured." };
  const row = await loadAppointment(id);
  if (!row) return { ok: false, message: "Request not found." };
  if (row.status !== "requested") return { ok: false, message: "Only new requests can be confirmed." };

  let googleEventId = row.google_event_id;
  let meetUrl = row.google_meet_url;
  let googleNote = "";
  try {
    const created = await createGoogleEvent(eventInput(row));
    if (created) {
      googleEventId = created.eventId;
      meetUrl = created.meetUrl;
    } else {
      googleNote = " Confirmed here. Google Calendar is not connected, so no invite was sent.";
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google Calendar failed.";
    return { ok: false, message };
  }

  const { error } = await admin
    .from("appointments")
    .update({
      status: "confirmed",
      google_event_id: googleEventId,
      google_meet_url: meetUrl,
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/calendar");
  revalidatePath("/account");
  return { ok: true, message: `Confirmed.${googleNote}` };
}

export async function declineAppointment(id: string, note: string): Promise<CalendarActionResult> {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Supabase admin is not configured." };
  const row = await loadAppointment(id);
  if (!row) return { ok: false, message: "Request not found." };
  if (row.google_event_id) {
    try {
      await deleteGoogleEvent(row.google_event_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update Google Calendar.";
      return { ok: false, message };
    }
  }
  const { error } = await admin
    .from("appointments")
    .update({
      status: "declined",
      admin_note: note.trim().slice(0, 500),
      google_event_id: null,
      google_meet_url: null,
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/calendar");
  revalidatePath("/account");
  return { ok: true, message: "Declined." };
}

export async function rescheduleAppointment(
  id: string,
  startsAtLocal: string,
): Promise<CalendarActionResult> {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Supabase admin is not configured." };
  const row = await loadAppointment(id);
  if (!row) return { ok: false, message: "Request not found." };
  if (row.status === "cancelled" || row.status === "declined" || row.status === "completed") {
    return { ok: false, message: "That appointment can no longer be moved." };
  }
  const startsAt = wallTimeInZoneToUtc(startsAtLocal);
  if (!startsAt) return { ok: false, message: "Pick a valid date and time (Eastern)." };
  const minutes = APPOINTMENT_MINUTES[row.type as AppointmentType] ?? 45;
  const endsAt = new Date(startsAt.getTime() + minutes * 60 * 1000);

  let meetUrl = row.google_meet_url;
  if (row.google_event_id) {
    try {
      const updated = await updateGoogleEvent(row.google_event_id, {
        ...eventInput(row),
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      });
      if (updated?.meetUrl) meetUrl = updated.meetUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update Google Calendar.";
      return { ok: false, message };
    }
  }

  const { error } = await admin
    .from("appointments")
    .update({
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      google_meet_url: meetUrl,
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/calendar");
  revalidatePath("/account");
  return { ok: true, message: "Time updated." };
}

export async function completeAppointment(id: string): Promise<CalendarActionResult> {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Supabase admin is not configured." };
  const { error } = await admin.from("appointments").update({ status: "completed" }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/calendar");
  revalidatePath("/account");
  return { ok: true, message: "Marked complete." };
}

export async function saveOfficeHours(formData: FormData): Promise<void> {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const weekdays = formData
    .getAll("weekday")
    .map((value) => Number(value))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  const start = String(formData.get("start") ?? "09:00");
  const end = String(formData.get("end") ?? "17:00");
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMin = (sh ?? 9) * 60 + (sm ?? 0);
  const endMin = (eh ?? 17) * 60 + (em ?? 0);
  const days = weekdays.length > 0 ? weekdays : [1, 2, 3, 4, 5];
  const windows = normalizeWindows(
    days.map((weekday) => ({
      weekday,
      startMin,
      endMin: endMin > startMin ? endMin : startMin + 60,
    })),
  );
  await admin.from("agent_availability").upsert({
    id: 1,
    timezone: "America/New_York",
    windows,
    updated_at: new Date().toISOString(),
  });
  revalidatePath("/admin/calendar");
}

export async function disconnectGoogleCalendarAction(): Promise<void> {
  await requireAdmin();
  await disconnectGoogleCalendar();
  revalidatePath("/admin/calendar");
}

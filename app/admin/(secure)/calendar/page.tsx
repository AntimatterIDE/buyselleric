import Link from "next/link";
import { disconnectGoogleCalendarAction, saveOfficeHours } from "@/app/actions/admin-calendar";
import { AdminCalendarBoard, type CalendarBoardItem } from "@/components/admin-calendar-board";
import { accountFieldClass, accountLabelClass } from "@/components/account-field";
import { addDaysToDateKey, formatDateKey, mondayDateKey, normalizeWindows, zonedParts } from "@/lib/buyer/time";
import { wallTimeInZoneToUtc } from "@/lib/buyer/time";
import type { AppointmentRow, AppointmentStatus, AppointmentType } from "@/lib/buyer/types";
import { getGoogleConnectionPublic, googleCalendarConfigured } from "@/lib/google-calendar";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; google?: string }>;
}): Promise<ReactNode> {
  const params = await searchParams;
  const weekKey = /^\d{4}-\d{2}-\d{2}$/.test(params.week ?? "")
    ? mondayDateKey(wallTimeInZoneToUtc(`${params.week}T12:00`) ?? new Date())
    : mondayDateKey();
  const days = Array.from({ length: 7 }, (_, index) => {
    const dateKey = addDaysToDateKey(weekKey, index);
    return { dateKey, label: formatDateKey(dateKey) };
  });
  const rangeStart = wallTimeInZoneToUtc(`${weekKey}T00:00`);
  const rangeEnd = wallTimeInZoneToUtc(`${addDaysToDateKey(weekKey, 7)}T00:00`);
  const prevWeek = addDaysToDateKey(weekKey, -7);
  const nextWeek = addDaysToDateKey(weekKey, 7);

  const client = createSupabaseAdminClient();
  let items: CalendarBoardItem[] = [];
  let schemaWarning = "";
  let windows = normalizeWindows(null);
  if (!client) {
    schemaWarning = "Supabase admin is not configured.";
  } else if (rangeStart && rangeEnd) {
    const [appointments, availability] = await Promise.all([
      client
        .from("appointments")
        .select("*, profiles(full_name, email, phone, wishes)")
        .gte("starts_at", rangeStart.toISOString())
        .lt("starts_at", rangeEnd.toISOString())
        .order("starts_at", { ascending: true }),
      client.from("agent_availability").select("windows").eq("id", 1).maybeSingle(),
    ]);
    if (appointments.error) {
      schemaWarning = appointments.error.message;
    } else {
      items = ((appointments.data ?? []) as Array<AppointmentRow & { profiles: BuyerBits | BuyerBits[] | null }>).map(
        (row) => {
          const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
          return {
            id: row.id,
            type: row.type as AppointmentType,
            status: row.status as AppointmentStatus,
            startsAt: row.starts_at,
            title: row.listing_title,
            address: row.listing_address,
            path: row.listing_path,
            notes: row.notes,
            buyerName: profile?.full_name ?? "",
            buyerEmail: profile?.email ?? "",
            wishes: profile?.wishes ?? "",
            meetUrl: row.google_meet_url,
            dateKey: zonedParts(new Date(row.starts_at)).dateKey,
          };
        },
      );
    }
    if (availability.data && typeof availability.data === "object" && "windows" in availability.data) {
      windows = normalizeWindows((availability.data as { windows?: unknown }).windows);
    }
  }

  const google = await getGoogleConnectionPublic();
  const googleBanner = googleBannerText(params.google, google.email);
  const selectedDays = new Set(windows.map((window) => window.weekday));
  const startClock = minutesToInput(windows[0]?.startMin ?? 9 * 60);
  const endClock = minutesToInput(windows[0]?.endMin ?? 17 * 60);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Calendar</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Confirm calls, appointments, and showings. Confirmed times are sent to Google Calendar when it is connected.
          </p>
        </div>
        <div className="flex gap-3 text-sm font-medium">
          <Link href={`/admin/calendar?week=${prevWeek}`} className="underline-offset-4 hover:underline">
            Previous week
          </Link>
          <Link href={`/admin/calendar?week=${nextWeek}`} className="underline-offset-4 hover:underline">
            Next week
          </Link>
        </div>
      </div>

      {schemaWarning ? (
        <p className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">{schemaWarning}</p>
      ) : null}
      {googleBanner ? (
        <p className="mt-4 rounded-xl bg-muted px-4 py-3 text-sm text-foreground">{googleBanner}</p>
      ) : null}

      <section className="mt-8 rounded-2xl border border-border p-4">
        <h2 className="text-sm font-semibold">Google Calendar</h2>
        {google.connected ? (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <p>Connected{google.email ? ` as ${google.email}` : ""}.</p>
            <form action={disconnectGoogleCalendarAction}>
              <button type="submit" className="font-semibold underline-offset-4 hover:underline">
                Disconnect
              </button>
            </form>
          </div>
        ) : (
          <div className="mt-2 text-sm text-muted-foreground">
            <p>Not connected. Confirm still books the appointment here.</p>
            {googleCalendarConfigured() ? (
              <Link href="/api/admin/google-calendar/start" className="mt-2 inline-block font-semibold text-foreground underline-offset-4 hover:underline">
                Connect Google Calendar
              </Link>
            ) : (
              <p className="mt-2">
                Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then connect. Redirect URL:{" "}
                <code className="text-xs">/api/admin/google-calendar/callback</code>
              </p>
            )}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-border p-4">
        <h2 className="text-sm font-semibold">Hours Eric can offer</h2>
        <form action={saveOfficeHours} className="mt-3 flex flex-wrap items-end gap-4">
          <fieldset className="flex flex-wrap gap-3">
            <legend className="sr-only">Weekdays</legend>
            {DAY_NAMES.map((name, weekday) => (
              <label key={name} className="inline-flex items-center gap-1 text-sm">
                <input type="checkbox" name="weekday" value={weekday} defaultChecked={selectedDays.has(weekday)} />
                {name}
              </label>
            ))}
          </fieldset>
          <label>
            <span className={accountLabelClass}>Start</span>
            <input type="time" name="start" defaultValue={startClock} className={accountFieldClass} />
          </label>
          <label>
            <span className={accountLabelClass}>End</span>
            <input type="time" name="end" defaultValue={endClock} className={accountFieldClass} />
          </label>
          <button type="submit" className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background">
            Save hours
          </button>
        </form>
      </section>

      <div className="mt-8">
        <AdminCalendarBoard days={days} items={items} />
      </div>
    </div>
  );
}

type BuyerBits = { full_name: string; email: string; phone: string; wishes: string };

function minutesToInput(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function googleBannerText(flag: string | undefined, email: string): string {
  if (flag === "connected") return `Google Calendar connected${email ? ` as ${email}` : ""}.`;
  if (flag === "missing") return "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET before connecting.";
  if (flag === "denied") return "Google Calendar connection was cancelled.";
  if (flag === "invalid") return "That Google Calendar link expired. Try connecting again.";
  if (flag === "failed") return "Google Calendar could not be connected. Check the redirect URL and try again.";
  return "";
}

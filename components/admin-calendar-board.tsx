"use client";

import { useState } from "react";
import {
  completeAppointment,
  confirmAppointment,
  declineAppointment,
  rescheduleAppointment,
  type CalendarActionResult,
} from "@/app/actions/admin-calendar";
import { accountFieldClass } from "@/components/account-field";
import { APPOINTMENT_LABELS, type AppointmentStatus, type AppointmentType } from "@/lib/buyer/types";
import { formatOfficeDateTime } from "@/lib/buyer/time";
import Link from "next/link";

export type CalendarBoardItem = {
  id: string;
  type: AppointmentType;
  status: AppointmentStatus;
  startsAt: string;
  title: string;
  address: string;
  path: string;
  notes: string;
  buyerName: string;
  buyerEmail: string;
  wishes: string;
  meetUrl: string | null;
  dateKey: string;
};

export function AdminCalendarBoard({
  days,
  items,
}: {
  days: Array<{ dateKey: string; label: string }>;
  items: CalendarBoardItem[];
}) {
  const [banner, setBanner] = useState<CalendarActionResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(id: string, task: () => Promise<CalendarActionResult>) {
    setBusy(id);
    const result = await task();
    setBanner(result);
    setBusy(null);
  }

  return (
    <div>
      {banner ? (
        <p
          className={`mb-4 rounded-xl px-4 py-3 text-sm ${
            banner.ok ? "bg-muted text-foreground" : "border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
          }`}
        >
          {banner.message}
        </p>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-7">
        {days.map((day) => {
          const dayItems = items.filter((item) => item.dateKey === day.dateKey);
          return (
            <section key={day.dateKey} className="min-h-40 rounded-2xl border border-border bg-muted/15 p-3">
              <h2 className="text-sm font-semibold text-foreground">{day.label}</h2>
              {dayItems.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">Open</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {dayItems.map((item) => (
                    <li key={item.id} className="rounded-xl border border-border bg-background p-3 text-sm">
                      <p className="font-semibold text-foreground">{formatOfficeDateTime(item.startsAt)}</p>
                      <p className="mt-1 text-muted-foreground">
                        {APPOINTMENT_LABELS[item.type]} · {item.status}
                      </p>
                      <p className="mt-2 font-medium text-foreground">{item.buyerName || item.buyerEmail}</p>
                      {item.buyerEmail ? <p className="text-muted-foreground">{item.buyerEmail}</p> : null}
                      {item.title ? (
                        <p className="mt-2">
                          {item.path ? (
                            <Link href={item.path} className="underline-offset-2 hover:underline">
                              {item.title}
                            </Link>
                          ) : (
                            item.title
                          )}
                        </p>
                      ) : null}
                      {item.address ? <p className="text-muted-foreground">{item.address}</p> : null}
                      {item.wishes ? <p className="mt-2 text-muted-foreground">Wishes: {item.wishes}</p> : null}
                      {item.notes ? <p className="mt-1 text-muted-foreground">Note: {item.notes}</p> : null}
                      {item.meetUrl ? (
                        <a href={item.meetUrl} className="mt-2 inline-block text-ring underline-offset-2 hover:underline">
                          Meet link
                        </a>
                      ) : null}
                      <div className="mt-3 flex flex-col gap-2">
                        {item.status === "requested" ? (
                          <button
                            type="button"
                            disabled={busy === item.id}
                            onClick={() => void run(item.id, () => confirmAppointment(item.id))}
                            className="rounded-full bg-foreground px-3 py-2 text-xs font-semibold text-background"
                          >
                            Confirm
                          </button>
                        ) : null}
                        {item.status === "confirmed" ? (
                          <button
                            type="button"
                            disabled={busy === item.id}
                            onClick={() => void run(item.id, () => completeAppointment(item.id))}
                            className="rounded-full border border-border px-3 py-2 text-xs font-semibold"
                          >
                            Complete
                          </button>
                        ) : null}
                        {item.status === "requested" || item.status === "confirmed" ? (
                          <>
                            <form
                              className="space-y-2"
                              onSubmit={(event) => {
                                event.preventDefault();
                                const data = new FormData(event.currentTarget);
                                const when = String(data.get("starts_at") ?? "");
                                void run(item.id, () => rescheduleAppointment(item.id, when));
                              }}
                            >
                              <input name="starts_at" type="datetime-local" required className={`${accountFieldClass} min-h-9 px-2 py-1 text-xs`} />
                              <button type="submit" className="text-xs font-semibold underline-offset-2 hover:underline">
                                Move time
                              </button>
                            </form>
                            <form
                              className="space-y-2"
                              onSubmit={(event) => {
                                event.preventDefault();
                                const data = new FormData(event.currentTarget);
                                const note = String(data.get("note") ?? "");
                                void run(item.id, () => declineAppointment(item.id, note));
                              }}
                            >
                              <input name="note" placeholder="Note" className={`${accountFieldClass} min-h-9 px-2 py-1 text-xs`} />
                              <button type="submit" className="text-xs font-semibold text-red-700 dark:text-red-300">
                                Decline
                              </button>
                            </form>
                          </>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

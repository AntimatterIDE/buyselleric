"use client";

import { useActionState } from "react";
import { requestAppointment, type BookingFormState } from "@/app/actions/appointments";
import { accountFieldClass, accountLabelClass } from "@/components/account-field";
import { ctaPrimary } from "@/lib/cta-styles";
import type { AppointmentType, HomeSource } from "@/lib/buyer/types";
import Link from "next/link";

export function AccountBookingForm({
  source,
  listingKey,
  title,
  address,
  path,
  defaultType,
}: {
  source: HomeSource | "";
  listingKey: string;
  title: string;
  address: string;
  path: string;
  defaultType: AppointmentType;
}) {
  const [state, formAction, pending] = useActionState<BookingFormState, FormData>(
    requestAppointment,
    null,
  );

  if (state?.ok) {
    return (
      <div className="mt-8 rounded-2xl border border-ring/40 bg-ring/10 p-6">
        <p className="text-lg font-semibold text-foreground">Request sent</p>
        <p className="mt-2 text-muted-foreground">{state.message}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/account" className="font-semibold text-foreground underline-offset-4 hover:underline">
            See it on your account
          </Link>
          <Link href="/talk" className="font-semibold text-foreground underline-offset-4 hover:underline">
            Talk to Eric
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <input type="hidden" name="listing_source" value={source} />
      <input type="hidden" name="listing_key" value={listingKey} />
      <input type="hidden" name="listing_title" value={title} />
      <input type="hidden" name="listing_address" value={address} />
      <input type="hidden" name="listing_path" value={path} />
      {title ? (
        <p className="rounded-xl bg-muted/40 px-4 py-3 text-sm text-foreground">
          For <span className="font-semibold">{title}</span>
          {address ? <span className="block text-muted-foreground">{address}</span> : null}
        </p>
      ) : null}
      <label className="block">
        <span className={accountLabelClass}>What do you need?</span>
        <select name="type" defaultValue={defaultType} className={accountFieldClass}>
          <option value="in_person_showing">In-person showing</option>
          <option value="virtual_call">Virtual call</option>
          <option value="appointment">Appointment</option>
        </select>
      </label>
      <label className="block">
        <span className={accountLabelClass}>When (Eastern time)</span>
        <input name="starts_at" type="datetime-local" required className={accountFieldClass} />
      </label>
      <label className="block">
        <span className={accountLabelClass}>Anything Eric should know</span>
        <textarea name="notes" rows={3} className={`${accountFieldClass} min-h-24`} />
      </label>
      {state?.ok === false ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {state.message}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={ctaPrimary}>
        {pending ? "Sending…" : "Request this time"}
      </button>
      <p className="text-sm text-muted-foreground">
        This asks Eric to confirm. It is not booked until he says yes.
      </p>
    </form>
  );
}

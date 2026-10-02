"use client";

import { useActionState } from "react";
import { saveProfile, type ProfileFormState } from "@/app/actions/account";
import { accountFieldClass, accountLabelClass } from "@/components/account-field";
import { ctaPrimary } from "@/lib/cta-styles";
import type { ProfileRow } from "@/lib/buyer/types";

export function AccountProfileForm({ profile }: { profile: ProfileRow }) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(saveProfile, null);
  const prefs = profile.preferences;

  return (
    <form action={formAction} className="mt-6 grid gap-4 sm:grid-cols-2">
      <label className="block sm:col-span-1">
        <span className={accountLabelClass}>Name</span>
        <input name="full_name" defaultValue={profile.full_name} required className={accountFieldClass} />
      </label>
      <label className="block sm:col-span-1">
        <span className={accountLabelClass}>Phone</span>
        <input name="phone" defaultValue={profile.phone} autoComplete="tel" className={accountFieldClass} />
      </label>
      <label className="block sm:col-span-1">
        <span className={accountLabelClass}>Budget up to</span>
        <input
          name="max_price"
          inputMode="numeric"
          defaultValue={prefs.maxPrice ? String(prefs.maxPrice) : ""}
          placeholder="450000"
          className={accountFieldClass}
        />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className={accountLabelClass}>Beds</span>
          <input
            name="min_beds"
            inputMode="numeric"
            defaultValue={prefs.minBeds ? String(prefs.minBeds) : ""}
            className={accountFieldClass}
          />
        </label>
        <label className="block">
          <span className={accountLabelClass}>Baths</span>
          <input
            name="min_baths"
            inputMode="decimal"
            defaultValue={prefs.minBaths ? String(prefs.minBaths) : ""}
            className={accountFieldClass}
          />
        </label>
      </div>
      <label className="block sm:col-span-2">
        <span className={accountLabelClass}>Areas</span>
        <input
          name="areas"
          defaultValue={prefs.areas.join(", ")}
          placeholder="Macon, Warner Robins"
          className={accountFieldClass}
        />
      </label>
      <label className="block sm:col-span-2">
        <span className={accountLabelClass}>Must-haves</span>
        <input
          name="must_haves"
          defaultValue={prefs.mustHaves.join(", ")}
          placeholder="pool, garage, fenced yard"
          className={accountFieldClass}
        />
      </label>
      <label className="block sm:col-span-2">
        <span className={accountLabelClass}>Wishes, in your words</span>
        <textarea
          name="wishes"
          rows={4}
          defaultValue={profile.wishes}
          placeholder="A quiet street, room for a shop, and a kitchen that can handle Sunday lunch."
          className={`${accountFieldClass} min-h-28`}
        />
      </label>
      {state ? (
        <p
          className={`sm:col-span-2 rounded-xl px-4 py-3 text-sm ${
            state.ok
              ? "border border-ring/40 bg-ring/10 text-foreground"
              : "border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
          }`}
        >
          {state.message}
        </p>
      ) : null}
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className={ctaPrimary}>
          {pending ? "Saving…" : "Save wishes"}
        </button>
      </div>
    </form>
  );
}

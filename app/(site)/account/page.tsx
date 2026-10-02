import Link from "next/link";
import { cancelAppointmentAction, signOutAccount } from "@/app/actions/account";
import { AccountProfileForm } from "@/components/account-profile-form";
import { BuyerSchemaError, ensureProfile, listAppointments, listSavedHomes } from "@/lib/buyer/data";
import { getBuyer } from "@/lib/buyer/session";
import { formatOfficeDateTime } from "@/lib/buyer/time";
import { APPOINTMENT_LABELS } from "@/lib/buyer/types";
import { ctaSecondary } from "@/lib/cta-styles";
import { createMetadata } from "@/lib/metadata";
import { eyebrow, innerPageMainTopPadding, lead, pageMain, sectionTitle, siteContainer } from "@/lib/ui";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Your account",
  description: "Wishes, saved homes, and appointments with Eric.",
  path: "/account",
  noIndex: true,
});

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}): Promise<ReactNode> {
  const buyer = await getBuyer();
  if (!buyer) redirect("/account/login?next=/account");
  const params = await searchParams;

  let loadError = "";
  let profile;
  try {
    profile = await ensureProfile(buyer.supabase, buyer.user);
  } catch (err) {
    loadError = err instanceof BuyerSchemaError ? err.message : "Your account could not be loaded.";
  }

  if (loadError || !profile) {
    return (
      <main id="main-content" className={pageMain} style={innerPageMainTopPadding}>
        <div className={siteContainer}>
          <h1 className={sectionTitle}>Your account</h1>
          <p className={`${lead} mt-4`}>{loadError || "Your account could not be loaded."}</p>
        </div>
      </main>
    );
  }

  const [saved, appointments] = await Promise.all([
    listSavedHomes(buyer.supabase, buyer.user.id),
    listAppointments(buyer.supabase, buyer.user.id),
  ]);
  const upcoming = appointments.filter(
    (row) => row.status === "requested" || row.status === "confirmed",
  );

  return (
    <main id="main-content" className={pageMain} style={innerPageMainTopPadding}>
      <div className={siteContainer}>
        <p className={eyebrow}>BuySellEric</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h1 className={sectionTitle}>{profile.full_name ? `${profile.full_name}'s wishes` : "Your wishes"}</h1>
          <div className="flex flex-wrap gap-3">
            <Link href="/talk" className={ctaSecondary}>
              Talk to Eric
            </Link>
            <form action={signOutAccount}>
              <button type="submit" className="min-h-12 text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                Log out
              </button>
            </form>
          </div>
        </div>
        {params.welcome ? (
          <p className={`${lead} mt-4`}>
            You are in. Tell Eric what you want, or fill this in yourself.
          </p>
        ) : (
          <p className={`${lead} mt-4`}>
            This is what Eric uses when he searches and when he books time with you.
          </p>
        )}

        <section className="mt-10 max-w-3xl rounded-3xl border border-border bg-muted/15 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight">Wishes</h2>
          <AccountProfileForm profile={profile} />
        </section>

        <section className="mt-10 max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight">Saved homes</h2>
          {saved.length === 0 ? (
            <p className="mt-3 text-muted-foreground">
              Nothing saved yet. Heart a home, or ask Eric to save one.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
              {saved.map((home) => (
                <li key={home.id} className="flex items-center justify-between gap-4 px-4 py-4">
                  <Link href={home.path || "/listings"} className="font-semibold text-foreground hover:underline">
                    {home.title || "Saved home"}
                  </Link>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">{home.source}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10 max-w-3xl">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-tight">Time with Eric</h2>
            <Link href="/account/book" className="text-sm font-semibold text-foreground underline-offset-4 hover:underline">
              Request a time
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="mt-3 text-muted-foreground">No upcoming requests. Eric confirms these before they are booked.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {upcoming.map((row) => (
                <li key={row.id} className="rounded-2xl border border-border bg-muted/15 p-4">
                  <p className="font-semibold text-foreground">
                    {APPOINTMENT_LABELS[row.type]} · {row.status === "confirmed" ? "Confirmed" : "Waiting on Eric"}
                  </p>
                  <p className="mt-1 text-muted-foreground">{formatOfficeDateTime(row.starts_at)}</p>
                  {row.listing_title ? (
                    <p className="mt-2">
                      <Link href={row.listing_path || "/listings"} className="underline-offset-4 hover:underline">
                        {row.listing_title}
                      </Link>
                    </p>
                  ) : null}
                  {row.google_meet_url ? (
                    <a href={row.google_meet_url} className="mt-2 inline-block text-sm font-semibold text-ring hover:underline">
                      Join the call
                    </a>
                  ) : null}
                  <form action={cancelAppointmentAction} className="mt-3">
                    <input type="hidden" name="id" value={row.id} />
                    <button type="submit" className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                      Cancel request
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

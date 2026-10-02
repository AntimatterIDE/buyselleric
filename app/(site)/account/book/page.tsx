import { AccountBookingForm } from "@/components/account-booking-form";
import { safeNextPath } from "@/lib/buyer/paths";
import { getBuyer } from "@/lib/buyer/session";
import type { AppointmentType, HomeSource } from "@/lib/buyer/types";
import { createMetadata } from "@/lib/metadata";
import { eyebrow, innerPageMainTopPadding, lead, pageMain, sectionTitle, siteContainer } from "@/lib/ui";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Request time with Eric",
  description: "Ask Eric to confirm a call, appointment, or showing.",
  path: "/account/book",
  noIndex: true,
});

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactNode> {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
  }
  const next = safeNextPath(`/account/book${query.size ? `?${query.toString()}` : ""}`, "/account/book");
  const buyer = await getBuyer();
  if (!buyer) redirect(`/account/signup?next=${encodeURIComponent(next)}`);

  const source = one(params.source);
  const homeSource: HomeSource | "" = source === "mls" || source === "manual" ? source : "";
  const listingKey = one(params.key);
  const title = one(params.title);
  const address = one(params.address);
  const path = one(params.path);
  const defaultType: AppointmentType = listingKey ? "in_person_showing" : "virtual_call";

  return (
    <main id="main-content" className={pageMain} style={innerPageMainTopPadding}>
      <div className={`${siteContainer} max-w-xl`}>
        <p className={eyebrow}>With Eric</p>
        <h1 className={`${sectionTitle} mt-3`}>Request a time</h1>
        <p className={`${lead} mt-4`}>
          Pick a slot during office hours. Eric confirms calls, appointments, and showings before they are booked.
        </p>
        <AccountBookingForm
          source={homeSource}
          listingKey={listingKey}
          title={title}
          address={address}
          path={path.startsWith("/listings") ? path : ""}
          defaultType={defaultType}
        />
      </div>
    </main>
  );
}

function one(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

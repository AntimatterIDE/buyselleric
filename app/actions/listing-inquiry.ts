"use server";

import { siteConfig } from "@/lib/config";
import { mailEricAndGuest } from "@/lib/mail";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ListingInquiryFormState =
  | { ok: true }
  | { ok: false; message: string }
  | null;

export async function submitListingInquiry(
  _prev: ListingInquiryFormState,
  formData: FormData,
): Promise<ListingInquiryFormState> {
  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const preferred_times = String(formData.get("preferred_times") ?? "").trim();
  const listing_source = String(formData.get("listing_source") ?? "").trim();
  const listing_id = String(formData.get("listing_id") ?? "").trim();
  const listing_title = String(formData.get("listing_title") ?? "").trim();
  const listing_path = String(formData.get("listing_path") ?? "").trim();

  if (!full_name || !email) {
    return { ok: false, message: "Name and email are required." };
  }

  const source =
    listing_source === "manual" || listing_source === "mls" ? listing_source : "";

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: "This form is not configured yet. Please try again later or call Eric directly.",
    };
  }

  const { error } = await supabase.from("listing_inquiries").insert({
    full_name,
    email,
    phone,
    message,
    preferred_times,
    listing_source: source,
    listing_id,
    listing_title,
    listing_path,
  });

  if (error) {
    console.error("submitListingInquiry", error.message);
    return { ok: false, message: "Something went wrong. Please try again." };
  }

  const home = listing_title || "a home";
  await mailEricAndGuest({
    guestEmail: email,
    ericSubject: `New inquiry from ${full_name}`,
    ericText: [full_name, email, phone, home, listing_path, preferred_times, message]
      .filter(Boolean)
      .join("\n"),
    guestSubject: "Eric got your message",
    guestText: `Thanks, ${full_name}. Eric has your note about ${home} and will follow up.\n\nYou can also reach him at ${siteConfig.phoneDisplay}.`,
  });

  return { ok: true };
}

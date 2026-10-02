"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BuyerSchemaError, cancelOwnAppointment, ensureProfile, updateProfile } from "@/lib/buyer/data";
import { safeNextPath } from "@/lib/buyer/paths";
import { getBuyer } from "@/lib/buyer/session";
import { normalizePreferences } from "@/lib/buyer/time";
import { siteConfig } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthFormState =
  | { ok: false; message: string }
  | { ok: true; message: string }
  | null;

export type ProfileFormState = { ok: false; message: string } | { ok: true; message: string } | null;

function friendlyAuthError(message: string): string {
  if (/already registered|already exists/i.test(message)) {
    return "That email already has an account. Log in instead.";
  }
  if (/invalid login|invalid credentials/i.test(message)) {
    return "That email and password did not match.";
  }
  if (/password/i.test(message) && /weak|short|least/i.test(message)) {
    return "Use a password of at least 8 characters.";
  }
  return message;
}

export async function signUpAccount(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Accounts are not configured yet." };

  const fullName = String(formData.get("full_name") ?? "").trim().slice(0, 120);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"), "/account?welcome=1");

  if (!fullName) return { ok: false, message: "Add your name so Eric knows who he is talking to." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "That email does not look right." };
  }
  if (password.length < 8) return { ok: false, message: "Use a password of at least 8 characters." };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${siteConfig.url}/account`,
    },
  });
  if (error) return { ok: false, message: friendlyAuthError(error.message) };
  if (!data.session) {
    return {
      ok: true,
      message: "Check your email to confirm the account, then log in. Eric will be here.",
    };
  }
  redirect(next);
}

export async function signInAccount(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Accounts are not configured yet." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"), "/account");
  if (!email || !password) return { ok: false, message: "Email and password are both required." };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, message: friendlyAuthError(error.message) };
  redirect(next);
}

export async function signOutAccount(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}

export async function saveProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const buyer = await getBuyer();
  if (!buyer) return { ok: false, message: "Log in to save your wishes." };

  const maxPriceRaw = String(formData.get("max_price") ?? "").replace(/[$,\s]/g, "");
  const minBedsRaw = String(formData.get("min_beds") ?? "").trim();
  const minBathsRaw = String(formData.get("min_baths") ?? "").trim();
  const areas = String(formData.get("areas") ?? "");
  const mustHaves = String(formData.get("must_haves") ?? "");

  try {
    const profile = await updateProfile(
      buyer.supabase,
      buyer.user,
      {
        fullName: String(formData.get("full_name") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        wishes: String(formData.get("wishes") ?? ""),
        preferences: normalizePreferences({
          maxPrice: maxPriceRaw ? Number(maxPriceRaw) : undefined,
          minBeds: minBedsRaw ? Number(minBedsRaw) : undefined,
          minBaths: minBathsRaw ? Number(minBathsRaw) : undefined,
          areas,
          mustHaves,
        }),
      },
      { replacePreferences: true },
    );
    revalidatePath("/account");
    revalidatePath("/talk");
    return { ok: true, message: `Saved. ${profile.full_name ? `${profile.full_name}, Eric` : "Eric"} has the latest.` };
  } catch (err) {
    if (err instanceof BuyerSchemaError) return { ok: false, message: err.message };
    return { ok: false, message: err instanceof Error ? err.message : "Could not save your profile." };
  }
}

export async function cancelAppointmentAction(formData: FormData): Promise<void> {
  const buyer = await getBuyer();
  if (!buyer) redirect("/account/login");
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/account");
  try {
    await ensureProfile(buyer.supabase, buyer.user);
    await cancelOwnAppointment(buyer.supabase, buyer.user.id, id);
  } catch (err) {
    console.error("cancelAppointment", err);
  }
  revalidatePath("/account");
  revalidatePath("/admin/calendar");
  redirect("/account");
}

import { getMlsListingById } from "@/lib/listings-queries";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  appointmentFitsAvailability,
  describeAvailability,
  normalizePreferences,
  normalizeWindows,
  preferenceSummary,
} from "@/lib/buyer/time";
import {
  APPOINTMENT_MINUTES,
  emptyPreferences,
  savedHomeComposite,
  type AppointmentRow,
  type AppointmentType,
  type AvailabilityWindow,
  type BuyerPreferences,
  type EricThreadMessage,
  type EricUiCard,
  type HomeSource,
  type ProfileRow,
  type SavedHomeRow,
} from "@/lib/buyer/types";

type DbError = { code?: string; message?: string } | null;

export class BuyerSchemaError extends Error {
  constructor() {
    super(
      "Buyer accounts are not ready yet. Run supabase/buyer-accounts.sql in the Supabase SQL editor.",
    );
    this.name = "BuyerSchemaError";
  }
}

export function isMissingBuyerSchema(error: DbError): boolean {
  if (!error) return false;
  const msg = error.message ?? "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist|schema cache|could not find the table/i.test(msg)
  );
}

function throwIfSchema(error: DbError): void {
  if (isMissingBuyerSchema(error)) throw new BuyerSchemaError();
}

function asProfile(row: Record<string, unknown>): ProfileRow {
  return {
    id: String(row.id),
    full_name: String(row.full_name ?? ""),
    email: String(row.email ?? ""),
    phone: String(row.phone ?? ""),
    wishes: String(row.wishes ?? ""),
    preferences: normalizePreferences(row.preferences),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export async function ensureProfile(supabase: SupabaseClient, user: User): Promise<ProfileRow> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  throwIfSchema(error);
  if (error) throw new Error(error.message);
  if (data) {
    const profile = asProfile(data as Record<string, unknown>);
    const email = user.email ?? "";
    if (email && profile.email !== email) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ email })
        .eq("id", user.id);
      if (!updateError) profile.email = email;
    }
    return profile;
  }

  const fullName =
    typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email ?? "",
      full_name: fullName,
      preferences: emptyPreferences(),
    })
    .select("*")
    .single();
  throwIfSchema(insertError);
  if (insertError || !inserted) {
    const { data: again, error: againError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    throwIfSchema(againError);
    if (againError || !again) throw new Error(insertError?.message ?? "Could not create profile");
    return asProfile(again as Record<string, unknown>);
  }
  return asProfile(inserted as Record<string, unknown>);
}

export type ProfilePatch = {
  fullName?: string;
  phone?: string;
  wishes?: string;
  preferences?: Partial<BuyerPreferences>;
};

export async function updateProfile(
  supabase: SupabaseClient,
  user: User,
  patch: ProfilePatch,
  options?: { replacePreferences?: boolean },
): Promise<ProfileRow> {
  const current = await ensureProfile(supabase, user);
  const nextPrefs: BuyerPreferences = options?.replacePreferences
    ? normalizePreferences(patch.preferences ?? current.preferences)
    : {
        ...current.preferences,
        ...stripEmptyPrefs(patch.preferences),
      };
  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: patch.fullName != null ? patch.fullName.trim().slice(0, 120) : current.full_name,
      phone: patch.phone != null ? patch.phone.trim().slice(0, 40) : current.phone,
      wishes: patch.wishes != null ? patch.wishes.trim().slice(0, 2000) : current.wishes,
      preferences: nextPrefs,
    })
    .eq("id", user.id)
    .select("*")
    .single();
  throwIfSchema(error);
  if (error || !data) throw new Error(error?.message ?? "Could not update profile");
  return asProfile(data as Record<string, unknown>);
}

function stripEmptyPrefs(patch: Partial<BuyerPreferences> | undefined): Partial<BuyerPreferences> {
  if (!patch) return {};
  const next: Partial<BuyerPreferences> = {};
  if (patch.maxPrice != null && patch.maxPrice > 0) next.maxPrice = patch.maxPrice;
  if (patch.minBeds != null && patch.minBeds > 0) next.minBeds = patch.minBeds;
  if (patch.minBaths != null && patch.minBaths > 0) next.minBaths = patch.minBaths;
  if (patch.areas) next.areas = patch.areas;
  if (patch.mustHaves) next.mustHaves = patch.mustHaves;
  return next;
}

export async function listSavedHomes(
  supabase: SupabaseClient,
  userId: string,
): Promise<SavedHomeRow[]> {
  const { data, error } = await supabase
    .from("saved_homes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  throwIfSchema(error);
  if (error) throw new Error(error.message);
  return (data ?? []) as SavedHomeRow[];
}

export async function listSavedHomeIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const rows = await listSavedHomes(supabase, userId);
  return new Set(rows.map((row) => savedHomeComposite(row.source, row.listing_key)));
}

export async function listSavedHomeIdsSafe(
  supabase: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  try {
    return await listSavedHomeIds(supabase, userId);
  } catch {
    return new Set();
  }
}

export async function listingExists(source: HomeSource, listingKey: string): Promise<boolean> {
  if (source === "mls") {
    const row = await getMlsListingById(listingKey);
    return Boolean(row);
  }
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("listings")
    .select("id")
    .eq("id", listingKey)
    .eq("is_published", true)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

export async function saveHome(
  supabase: SupabaseClient,
  userId: string,
  input: { source: HomeSource; listingKey: string; title: string; path: string },
): Promise<void> {
  const exists = await listingExists(input.source, input.listingKey);
  if (!exists) throw new Error("That home is not in the current inventory.");
  const { error } = await supabase.from("saved_homes").upsert(
    {
      user_id: userId,
      source: input.source,
      listing_key: input.listingKey,
      title: input.title.slice(0, 200),
      path: input.path.slice(0, 300),
    },
    { onConflict: "user_id,source,listing_key" },
  );
  throwIfSchema(error);
  if (error) throw new Error(error.message);
}

export async function unsaveHome(
  supabase: SupabaseClient,
  userId: string,
  source: HomeSource,
  listingKey: string,
): Promise<void> {
  const { error } = await supabase
    .from("saved_homes")
    .delete()
    .eq("user_id", userId)
    .eq("source", source)
    .eq("listing_key", listingKey);
  throwIfSchema(error);
  if (error) throw new Error(error.message);
}

export async function getAvailability(supabase: SupabaseClient): Promise<{
  timezone: string;
  windows: AvailabilityWindow[];
}> {
  const { data, error } = await supabase
    .from("agent_availability")
    .select("timezone, windows")
    .eq("id", 1)
    .maybeSingle();
  throwIfSchema(error);
  if (error || !data) {
    return { timezone: "America/New_York", windows: normalizeWindows(null) };
  }
  const row = data as { timezone?: string; windows?: unknown };
  return {
    timezone: row.timezone || "America/New_York",
    windows: normalizeWindows(row.windows),
  };
}

export async function listAppointments(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppointmentRow[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("user_id", userId)
    .order("starts_at", { ascending: true });
  throwIfSchema(error);
  if (error) throw new Error(error.message);
  return (data ?? []) as AppointmentRow[];
}

export type AppointmentRequestInput = {
  type: AppointmentType;
  startsAt: Date;
  listingSource?: string;
  listingKey?: string;
  listingTitle?: string;
  listingAddress?: string;
  listingPath?: string;
  notes?: string;
};

export async function createAppointmentRequest(
  supabase: SupabaseClient,
  userId: string,
  input: AppointmentRequestInput,
): Promise<AppointmentRow> {
  const minutes = APPOINTMENT_MINUTES[input.type];
  const endsAt = new Date(input.startsAt.getTime() + minutes * 60 * 1000);
  const now = Date.now();
  if (input.startsAt.getTime() < now + 60 * 60 * 1000) {
    throw new Error("Pick a time at least an hour from now.");
  }
  if (input.startsAt.getTime() > now + 90 * 24 * 60 * 60 * 1000) {
    throw new Error("Eric books up to 90 days out.");
  }

  const { windows, timezone } = await getAvailability(supabase);
  if (!appointmentFitsAvailability(input.startsAt, endsAt, windows, timezone)) {
    throw new Error(`That time is outside office hours (${describeAvailability(windows)}).`);
  }

  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const admin = createSupabaseAdminClient();
  if (admin) {
    const { data: clashes, error: clashError } = await admin
      .from("appointments")
      .select("id")
      .eq("status", "confirmed")
      .lt("starts_at", endsAt.toISOString())
      .gt("ends_at", input.startsAt.toISOString())
      .limit(1);
    if (!clashError && clashes && clashes.length > 0) {
      throw new Error("That time is already booked. Try another slot.");
    }
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      user_id: userId,
      type: input.type,
      status: "requested",
      starts_at: input.startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      listing_source: input.listingSource ?? "",
      listing_key: input.listingKey ?? "",
      listing_title: (input.listingTitle ?? "").slice(0, 200),
      listing_address: (input.listingAddress ?? "").slice(0, 300),
      listing_path: (input.listingPath ?? "").slice(0, 300),
      notes: (input.notes ?? "").slice(0, 1000),
    })
    .select("*")
    .single();
  throwIfSchema(error);
  if (error || !data) throw new Error(error?.message ?? "Could not request that time");
  return data as AppointmentRow;
}

export async function cancelOwnAppointment(
  supabase: SupabaseClient,
  userId: string,
  appointmentId: string,
): Promise<AppointmentRow> {
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .eq("user_id", userId)
    .maybeSingle();
  throwIfSchema(error);
  if (error || !data) throw new Error("That request was not found.");
  const row = data as AppointmentRow;
  if (row.status !== "requested" && row.status !== "confirmed") {
    throw new Error("That request can no longer be cancelled.");
  }
  if (row.google_event_id) {
    try {
      const { deleteGoogleEvent } = await import("@/lib/google-calendar");
      await deleteGoogleEvent(row.google_event_id);
    } catch (err) {
      console.error("cancel appointment google event", err);
    }
  }
  const { error: updateError } = await supabase
    .from("appointments")
    .update({ status: "cancelled", google_event_id: null, google_meet_url: null })
    .eq("id", appointmentId)
    .eq("user_id", userId);
  throwIfSchema(updateError);
  if (updateError) throw new Error(updateError.message);
  return row;
}

export async function ensureConversation(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("eric_conversations")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  throwIfSchema(error);
  if (error) throw new Error(error.message);
  if (data && typeof (data as { id?: string }).id === "string") return (data as { id: string }).id;

  const { data: inserted, error: insertError } = await supabase
    .from("eric_conversations")
    .insert({ user_id: userId })
    .select("id")
    .single();
  throwIfSchema(insertError);
  if (insertError || !inserted) throw new Error(insertError?.message ?? "Could not start the chat");
  return (inserted as { id: string }).id;
}

function cardsFromPayload(payload: unknown): EricUiCard[] {
  if (!payload || typeof payload !== "object") return [];
  const cards = (payload as { cards?: unknown }).cards;
  if (!Array.isArray(cards)) return [];
  return cards as EricUiCard[];
}

export async function listEricMessages(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<EricThreadMessage[]> {
  const { data, error } = await supabase
    .from("eric_messages")
    .select("id, role, content, tool_payload, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(40);
  throwIfSchema(error);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    tool_payload: unknown;
    created_at: string;
  }>;
  return rows
    .slice()
    .reverse()
    .map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      cards: cardsFromPayload(row.tool_payload),
      createdAt: row.created_at,
    }));
}

export async function insertEricMessage(
  supabase: SupabaseClient,
  conversationId: string,
  message: { role: "user" | "assistant"; content: string; cards?: EricUiCard[] },
): Promise<EricThreadMessage> {
  const { data, error } = await supabase
    .from("eric_messages")
    .insert({
      conversation_id: conversationId,
      role: message.role,
      content: message.content,
      tool_payload: message.cards && message.cards.length > 0 ? { cards: message.cards } : null,
    })
    .select("id, role, content, tool_payload, created_at")
    .single();
  throwIfSchema(error);
  if (error || !data) throw new Error(error?.message ?? "Could not save the message");
  const row = data as {
    id: string;
    role: "user" | "assistant";
    content: string;
    tool_payload: unknown;
    created_at: string;
  };
  await supabase
    .from("eric_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    cards: cardsFromPayload(row.tool_payload),
    createdAt: row.created_at,
  };
}

export function profileLine(profile: ProfileRow): string {
  return preferenceSummary(profile.preferences, profile.wishes);
}

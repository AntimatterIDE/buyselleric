import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { siteConfig } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AppointmentType } from "@/lib/buyer/types";
import { APPOINTMENT_LABELS } from "@/lib/buyer/types";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export type GoogleConnectionPublic = {
  connected: boolean;
  email: string;
};

type StoredConnection = {
  refresh_token: string;
  calendar_id: string;
  email: string;
};

export function googleRedirectUri(): string {
  const explicit = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return `${siteConfig.url}/api/admin/google-calendar/callback`;
}

export function googleCalendarConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function sealGoogleOAuthState(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not set");
  const exp = Math.floor(Date.now() / 1000) + 10 * 60;
  const nonce = randomBytes(8).toString("hex");
  const payload = `${exp}.${nonce}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyGoogleOAuthState(state: string): boolean {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [expRaw, nonce, sig] = parts;
  if (!expRaw || !nonce || !sig) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const payload = `${expRaw}.${nonce}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function googleAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not set");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string): Promise<void> {
  const tokens = await requestToken({
    code,
    grant_type: "authorization_code",
    redirect_uri: googleRedirectUri(),
  });
  if (!tokens.refresh_token) {
    throw new Error("Google did not return a refresh token. Try connecting again.");
  }
  const email = await fetchGoogleEmail(tokens.access_token);
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured.");
  const { error } = await admin.from("google_calendar_connection").upsert({
    id: 1,
    refresh_token: tokens.refresh_token,
    calendar_id: "primary",
    email,
    connected_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function getGoogleConnectionPublic(): Promise<GoogleConnectionPublic> {
  const row = await readConnection();
  if (!row) return { connected: false, email: "" };
  return { connected: true, email: row.email };
}

export async function disconnectGoogleCalendar(): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured.");
  const { error } = await admin.from("google_calendar_connection").delete().eq("id", 1);
  if (error) throw new Error(error.message);
}

export type CalendarEventInput = {
  appointmentId: string;
  type: AppointmentType;
  startsAt: string;
  endsAt: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  wishes: string;
  listingTitle: string;
  listingAddress: string;
  listingPath: string;
  notes: string;
};

export async function createGoogleEvent(
  input: CalendarEventInput,
): Promise<{ eventId: string; meetUrl: string | null } | null> {
  const token = await accessTokenOrNull();
  if (!token) return null;
  const body = eventBody(input);
  const created = await insertEvent(token, body, Boolean(input.buyerEmail));
  return {
    eventId: created.id,
    meetUrl: meetLink(created),
  };
}

export async function updateGoogleEvent(
  eventId: string,
  input: CalendarEventInput,
): Promise<{ meetUrl: string | null } | null> {
  const token = await accessTokenOrNull();
  if (!token) return null;
  const url = `${EVENTS_URL}/${encodeURIComponent(eventId)}?sendUpdates=all`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      start: { dateTime: input.startsAt },
      end: { dateTime: input.endsAt },
      summary: eventSummary(input),
      description: eventDescription(input),
      location: input.type === "in_person_showing" ? input.listingAddress || undefined : undefined,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(googleErrorMessage(text) || "Could not update the Google Calendar event.");
  }
  const data = (await res.json()) as GoogleEvent;
  return { meetUrl: meetLink(data) };
}

export async function deleteGoogleEvent(eventId: string): Promise<void> {
  const token = await accessTokenOrNull();
  if (!token) return;
  const url = `${EVENTS_URL}/${encodeURIComponent(eventId)}?sendUpdates=all`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const text = await res.text();
    throw new Error(googleErrorMessage(text) || "Could not remove the Google Calendar event.");
  }
}

async function accessTokenOrNull(): Promise<string | null> {
  const row = await readConnection();
  if (!row) return null;
  if (!googleCalendarConfigured()) return null;
  const tokens = await requestToken({
    refresh_token: row.refresh_token,
    grant_type: "refresh_token",
  });
  return tokens.access_token;
}

async function readConnection(): Promise<StoredConnection | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("google_calendar_connection")
    .select("refresh_token, calendar_id, email")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as StoredConnection;
  if (!row.refresh_token) return null;
  return row;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

async function requestToken(fields: Record<string, string>): Promise<TokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google Calendar is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      ...fields,
    }),
  });
  const data = (await res.json()) as TokenResponse & { error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Google token request failed.");
  }
  return data;
}

async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return "";
  const data = (await res.json()) as { email?: string };
  return data.email ?? "";
}

type GoogleEvent = {
  id: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
  };
};

function eventSummary(input: CalendarEventInput): string {
  const who = input.buyerName.trim() || input.buyerEmail || "Buyer";
  return `${APPOINTMENT_LABELS[input.type]} with ${who}`;
}

function eventDescription(input: CalendarEventInput): string {
  const lines = [
    `${siteConfig.name} appointment`,
    input.buyerEmail ? `Email: ${input.buyerEmail}` : "",
    input.buyerPhone ? `Phone: ${input.buyerPhone}` : "",
    input.listingTitle ? `Home: ${input.listingTitle}` : "",
    input.listingAddress ? `Address: ${input.listingAddress}` : "",
    input.listingPath ? `Listing: ${siteConfig.url}${input.listingPath}` : "",
    input.wishes ? `Wishes: ${input.wishes}` : "",
    input.notes ? `Notes: ${input.notes}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

function eventBody(input: CalendarEventInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    summary: eventSummary(input),
    description: eventDescription(input),
    start: { dateTime: input.startsAt },
    end: { dateTime: input.endsAt },
  };
  if (input.type === "in_person_showing" && input.listingAddress) {
    body.location = input.listingAddress;
  }
  if (input.buyerEmail) {
    body.attendees = [{ email: input.buyerEmail }];
  }
  if (input.type === "virtual_call") {
    body.conferenceData = {
      createRequest: {
        requestId: input.appointmentId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }
  return body;
}

async function insertEvent(
  token: string,
  body: Record<string, unknown>,
  withAttendee: boolean,
): Promise<GoogleEvent> {
  const url = `${EVENTS_URL}?conferenceDataVersion=1&sendUpdates=all`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok && withAttendee) {
    const text = await res.text();
    if (/attendee|forbidden|delegation/i.test(text)) {
      const rest = { ...body };
      delete rest.attendees;
      return insertEvent(token, rest, false);
    }
    throw new Error(googleErrorMessage(text) || "Could not create the Google Calendar event.");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(googleErrorMessage(text) || "Could not create the Google Calendar event.");
  }
  return (await res.json()) as GoogleEvent;
}

function meetLink(event: GoogleEvent): string | null {
  if (event.hangoutLink) return event.hangoutLink;
  const video = event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video");
  return video?.uri ?? null;
}

function googleErrorMessage(text: string): string {
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } | string };
    if (typeof parsed.error === "string") return parsed.error;
    if (parsed.error && typeof parsed.error === "object" && parsed.error.message) {
      return parsed.error.message;
    }
  } catch {
    // fall through
  }
  return text.slice(0, 240);
}

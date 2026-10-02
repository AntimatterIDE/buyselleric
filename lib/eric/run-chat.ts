import OpenAI from "openai";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  createAppointmentRequest,
  ensureConversation,
  ensureProfile,
  getAvailability,
  insertEricMessage,
  listAppointments,
  listEricMessages,
  listSavedHomes,
  profileLine,
  saveHome,
  unsaveHome,
  updateProfile,
} from "@/lib/buyer/data";
import { describeAvailability, formatOfficeDateTime, preferenceSummary, wallTimeInZoneToUtc } from "@/lib/buyer/time";
import {
  APPOINTMENT_LABELS,
  type AppointmentType,
  type EricThreadMessage,
  type EricUiCard,
  type HomeSource,
} from "@/lib/buyer/types";
import { siteConfig } from "@/lib/config";
import { searchHomesForEric } from "@/lib/eric/search";

const MODEL = "gpt-4o-mini";
const APPOINTMENT_TYPES = new Set<AppointmentType>([
  "virtual_call",
  "appointment",
  "in_person_showing",
]);

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_homes",
      description:
        "Search live Georgia listings. Call this before mentioning any home. Pass a natural-language prompt that includes location, budget, beds, and must-haves.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          prompt: {
            type: "string",
            description: "What to search for, in plain language.",
          },
        },
        required: ["prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_profile",
      description:
        "Save what the buyer wants on their profile. Only include fields they just stated. Prices are whole US dollars.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          wishes: { type: "string", description: "Freeform notes about the home they want." },
          maxPrice: { type: "number", description: "Maximum budget in whole dollars." },
          minBeds: { type: "number" },
          minBaths: { type: "number" },
          areas: {
            type: "array",
            items: { type: "string" },
            description: "Cities or areas, replacing the previous list when provided.",
          },
          mustHaves: {
            type: "array",
            items: { type: "string" },
            description: "Must-have features, replacing the previous list when provided.",
          },
          phone: { type: "string" },
          fullName: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_home",
      description:
        "Save a home that search_homes just returned. Copy source, listingKey, title, and path exactly.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          source: { type: "string", enum: ["mls", "manual"] },
          listingKey: { type: "string" },
          title: { type: "string" },
          path: { type: "string" },
        },
        required: ["source", "listingKey", "title", "path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "unsave_home",
      description: "Remove a saved home.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          source: { type: "string", enum: ["mls", "manual"] },
          listingKey: { type: "string" },
        },
        required: ["source", "listingKey"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_appointment",
      description:
        "Request time with the real Eric. This is a request only, never a confirmed booking. startsAt is Eastern wall time YYYY-MM-DDTHH:mm with no timezone suffix.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: {
            type: "string",
            enum: ["virtual_call", "appointment", "in_person_showing"],
          },
          startsAt: { type: "string", description: "Eastern time, YYYY-MM-DDTHH:mm" },
          listingSource: { type: "string", enum: ["mls", "manual", ""] },
          listingKey: { type: "string" },
          listingTitle: { type: "string" },
          listingAddress: { type: "string" },
          listingPath: { type: "string" },
          notes: { type: "string" },
        },
        required: ["type", "startsAt"],
      },
    },
  },
];

function systemPrompt(input: {
  name: string;
  profileText: string;
  hours: string;
  saved: string;
  upcoming: string;
}): string {
  return `You are Eric on ${siteConfig.name}, a cartoon version of ${siteConfig.agentName}, a Georgia real estate agent (${siteConfig.primaryMarket}). You sound warm, specific, and a little playful. Short sentences. You are not a generic assistant and you never say you are an AI, a bot, or a language model.

You help this buyer find homes, remember what they want, save homes, and request time with the real Eric.

Buyer: ${input.name || "not named yet"}
Profile:
${input.profileText}

Saved homes:
${input.saved}

Upcoming requests:
${input.upcoming}

Office hours: ${input.hours}

Rules:
- Only talk about homes returned by search_homes. Never invent an address, price, or MLS number.
- When they ask to see homes, call search_homes. If they are vague, fold their saved wishes into the prompt.
- save_home and unsave_home only for homes search_homes returned, copying source, listingKey, title, and path exactly.
- When they tell you what they want, call update_profile.
- request_appointment creates a request. Tell them Eric will confirm it. Never say a time is booked, confirmed, or on the calendar.
- startsAt is America/New_York wall time as YYYY-MM-DDTHH:mm, inside office hours, at least an hour from now.
- If a tool returns an error, say so in your own words and offer a fix.
- Keep replies to two or four sentences. The cards show the homes and the request.
- You do not write offers, give legal advice, or quote rates. Offer a call for that.`;
}

export async function handleEricMessage(
  supabase: SupabaseClient,
  user: User,
  text: string,
): Promise<EricThreadMessage> {
  const trimmed = text.trim().slice(0, 2000);
  if (trimmed.length < 1) throw new Error("Say something first.");

  const profile = await ensureProfile(supabase, user);
  const conversationId = await ensureConversation(supabase, user.id);
  await insertEricMessage(supabase, conversationId, { role: "user", content: trimmed });

  const history = await listEricMessages(supabase, conversationId);
  const cards: EricUiCard[] = [];

  let reply: string;
  if (!process.env.OPENAI_API_KEY) {
    reply =
      "I can hear you, but the chat line is not connected yet. Your wishes and saved homes on your profile still work, and you can request a time from any home.";
  } else {
    reply = await completeWithTools({
      supabase,
      user,
      history,
      cards,
      profileName: profile.full_name,
    });
  }

  return insertEricMessage(supabase, conversationId, {
    role: "assistant",
    content: reply,
    cards,
  });
}

async function completeWithTools(input: {
  supabase: SupabaseClient;
  user: User;
  history: EricThreadMessage[];
  cards: EricUiCard[];
  profileName: string;
}): Promise<string> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const [saved, appointments, availability, profile] = await Promise.all([
    listSavedHomes(input.supabase, input.user.id),
    listAppointments(input.supabase, input.user.id),
    getAvailability(input.supabase),
    ensureProfile(input.supabase, input.user),
  ]);

  const upcoming = appointments
    .filter((row) => row.status === "requested" || row.status === "confirmed")
    .slice(0, 6)
    .map(
      (row) =>
        `${APPOINTMENT_LABELS[row.type]} ${formatOfficeDateTime(row.starts_at)} (${row.status})${row.listing_title ? ` · ${row.listing_title}` : ""}`,
    )
    .join("\n");

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: systemPrompt({
        name: input.profileName || profile.full_name,
        profileText: profileLine(profile),
        hours: describeAvailability(availability.windows),
        saved:
          saved.length > 0
            ? saved
                .slice(0, 12)
                .map((row) => `${row.title} [${row.source}:${row.listing_key}] ${row.path}`)
                .join("\n")
            : "None yet.",
        upcoming: upcoming || "None.",
      }),
    },
    ...input.history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];

  let text = "";
  for (let round = 0; round < 4; round += 1) {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages,
      tools: TOOLS,
      temperature: 0.7,
      max_tokens: 700,
    });
    const message = response.choices[0]?.message;
    if (!message) break;
    const toolCalls = message.tool_calls ?? [];
    if (toolCalls.length === 0) {
      text = message.content?.trim() ?? "";
      break;
    }

    messages.push({
      role: "assistant",
      content: message.content ?? "",
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      if (call.type !== "function") continue;
      const result = await runTool(input.supabase, input.user, call.function.name, call.function.arguments, input.cards);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  if (!text) {
    text = input.cards.length
      ? "Take a look. Tell me which one to save, or what to change."
      : "Say that once more and I will take it from there.";
  }
  return text;
}

async function runTool(
  supabase: SupabaseClient,
  user: User,
  name: string,
  rawArgs: string,
  cards: EricUiCard[],
): Promise<Record<string, unknown>> {
  let args: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(rawArgs || "{}") as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      args = parsed as Record<string, unknown>;
    }
  } catch {
    return { ok: false, message: "Those details were not readable." };
  }

  try {
    if (name === "search_homes") {
      const prompt = stringArg(args.prompt);
      if (prompt.length < 3) return { ok: false, message: "Need a bit more to search on." };
      const found = await searchHomesForEric(prompt);
      cards.push({
        kind: "homes",
        summary: found.summary,
        href: found.href,
        total: found.total,
        homes: found.homes,
      });
      return {
        ok: true,
        summary: found.summary,
        total: found.total,
        href: found.href,
        homes: found.homes.map((home) => ({
          source: home.source,
          listingKey: home.listingKey,
          title: home.title,
          path: home.path,
          price: home.priceLabel,
          city: home.city,
          beds: home.beds,
          baths: home.baths,
          address: home.address,
        })),
      };
    }

    if (name === "update_profile") {
      const maxPrice = numberArg(args.maxPrice);
      const minBeds = numberArg(args.minBeds);
      const minBaths = numberArg(args.minBaths);
      const areas = Array.isArray(args.areas)
        ? args.areas.filter((v): v is string => typeof v === "string")
        : undefined;
      const mustHaves = Array.isArray(args.mustHaves)
        ? args.mustHaves.filter((v): v is string => typeof v === "string")
        : undefined;
      const profile = await updateProfile(supabase, user, {
        ...(typeof args.fullName === "string" ? { fullName: args.fullName } : {}),
        ...(typeof args.phone === "string" ? { phone: args.phone } : {}),
        ...(typeof args.wishes === "string" ? { wishes: args.wishes } : {}),
        preferences: {
          ...(maxPrice != null ? { maxPrice } : {}),
          ...(minBeds != null ? { minBeds } : {}),
          ...(minBaths != null ? { minBaths } : {}),
          ...(areas ? { areas } : {}),
          ...(mustHaves ? { mustHaves } : {}),
        },
      });
      const summary = preferenceSummary(profile.preferences, profile.wishes);
      cards.push({ kind: "profile", summary });
      return { ok: true, summary };
    }

    if (name === "save_home" || name === "unsave_home") {
      const source = args.source === "manual" ? "manual" : args.source === "mls" ? "mls" : null;
      const listingKey = stringArg(args.listingKey);
      if (!source || !listingKey) return { ok: false, message: "Missing the home id from search." };
      if (name === "unsave_home") {
        await unsaveHome(supabase, user.id, source, listingKey);
        cards.push({
          kind: "saved",
          saved: false,
          title: stringArg(args.title) || "That home",
          path: stringArg(args.path) || "/account",
        });
        return { ok: true, saved: false };
      }
      const title = stringArg(args.title);
      const path = stringArg(args.path);
      if (!title || !path.startsWith("/listings")) {
        return { ok: false, message: "Save only a home that search just returned." };
      }
      await saveHome(supabase, user.id, { source, listingKey, title, path });
      cards.push({ kind: "saved", saved: true, title, path });
      return { ok: true, saved: true, title };
    }

    if (name === "request_appointment") {
      const type = stringArg(args.type) as AppointmentType;
      if (!APPOINTMENT_TYPES.has(type)) return { ok: false, message: "Unknown appointment type." };
      const startsAt = wallTimeInZoneToUtc(stringArg(args.startsAt));
      if (!startsAt) return { ok: false, message: "startsAt must look like 2026-10-06T14:00 Eastern." };
      const listingSource = args.listingSource === "mls" || args.listingSource === "manual" ? args.listingSource : "";
      const row = await createAppointmentRequest(supabase, user.id, {
        type,
        startsAt,
        listingSource,
        listingKey: stringArg(args.listingKey),
        listingTitle: stringArg(args.listingTitle),
        listingAddress: stringArg(args.listingAddress),
        listingPath: stringArg(args.listingPath),
        notes: stringArg(args.notes),
      });
      cards.push({
        kind: "appointment",
        id: row.id,
        type: row.type,
        startsAt: row.starts_at,
        status: row.status,
        title: row.listing_title || APPOINTMENT_LABELS[row.type],
      });
      return {
        ok: true,
        status: "requested",
        when: formatOfficeDateTime(row.starts_at),
        message: "Request saved. Eric still has to confirm it.",
      };
    }

    return { ok: false, message: "Unknown tool." };
  } catch (err) {
    const message = err instanceof Error ? err.message : "That did not go through.";
    return { ok: false, message };
  }
}

function stringArg(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberArg(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

export function isHomeSource(value: string): value is HomeSource {
  return value === "mls" || value === "manual";
}

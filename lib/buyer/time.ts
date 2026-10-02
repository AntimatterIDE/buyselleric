import {
  DEFAULT_AVAILABILITY,
  type AvailabilityWindow,
  type BuyerPreferences,
} from "@/lib/buyer/types";

export const OFFICE_TIME_ZONE = "America/New_York";

const WEEKDAY_SHORT: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function zoneOffsetMs(date: Date, timeZone = OFFICE_TIME_ZONE): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const bag: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  const hour = bag.hour === "24" ? "0" : bag.hour;
  const asUtc = Date.UTC(
    Number(bag.year),
    Number(bag.month) - 1,
    Number(bag.day),
    Number(hour),
    Number(bag.minute),
    Number(bag.second),
  );
  return asUtc - date.getTime();
}

/** `YYYY-MM-DDTHH:mm` wall time in the office timezone → UTC Date. */
export function wallTimeInZoneToUtc(wall: string, timeZone = OFFICE_TIME_ZONE): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(wall.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset1 = zoneOffsetMs(new Date(utcGuess), timeZone);
  let utc = utcGuess - offset1;
  const offset2 = zoneOffsetMs(new Date(utc), timeZone);
  if (offset2 !== offset1) utc = utcGuess - offset2;
  const result = new Date(utc);
  return Number.isNaN(result.getTime()) ? null : result;
}

export type ZonedParts = {
  weekday: number;
  minutes: number;
  dateKey: string;
};

export function zonedParts(date: Date, timeZone = OFFICE_TIME_ZONE): ZonedParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  const hour = bag.hour === "24" ? 0 : Number(bag.hour);
  const weekday = WEEKDAY_SHORT[bag.weekday ?? ""] ?? 0;
  const dateKey = `${bag.year}-${bag.month}-${bag.day}`;
  return { weekday, minutes: hour * 60 + Number(bag.minute), dateKey };
}

export function formatMinutes(mins: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, mins));
  const h24 = Math.floor(clamped / 60);
  const m = clamped % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function parseClockToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function minutesToClock(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function describeAvailability(windows: AvailabilityWindow[]): string {
  if (windows.length === 0) return "No open hours are set.";
  return windows
    .slice()
    .sort((a, b) => a.weekday - b.weekday || a.startMin - b.startMin)
    .map(
      (w) =>
        `${WEEKDAY_NAMES[w.weekday] ?? "Day"} ${formatMinutes(w.startMin)} to ${formatMinutes(w.endMin)} ET`,
    )
    .join("; ");
}

export function appointmentFitsAvailability(
  start: Date,
  end: Date,
  windows: AvailabilityWindow[],
  timeZone = OFFICE_TIME_ZONE,
): boolean {
  const open = windows.length > 0 ? windows : DEFAULT_AVAILABILITY;
  const a = zonedParts(start, timeZone);
  const b = zonedParts(end, timeZone);
  if (a.dateKey !== b.dateKey) return false;
  return open.some(
    (w) => w.weekday === a.weekday && a.minutes >= w.startMin && b.minutes <= w.endMin,
  );
}

export function formatOfficeDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: OFFICE_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${label} ET`;
}

export function mondayDateKey(from = new Date(), timeZone = OFFICE_TIME_ZONE): string {
  const parts = zonedParts(from, timeZone);
  const parsed = readDateKey(parts.dateKey);
  if (!parsed) return parts.dateKey;
  const back = parts.weekday === 0 ? 6 : parts.weekday - 1;
  const monday = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day - back));
  return monday.toISOString().slice(0, 10);
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const parsed = readDateKey(dateKey);
  if (!parsed) return dateKey;
  const next = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return next.toISOString().slice(0, 10);
}

function readDateKey(dateKey: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1] ?? "");
  const month = Number(match[2] ?? "");
  const day = Number(match[3] ?? "");
  if (!year || !month || !day) return null;
  return { year, month, day };
}

export function formatDateKey(dateKey: string): string {
  const start = wallTimeInZoneToUtc(`${dateKey}T12:00`);
  if (!start) return dateKey;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: OFFICE_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(start);
}

export function normalizePreferences(value: unknown): BuyerPreferences {
  const empty = { areas: [], mustHaves: [] };
  if (!value || typeof value !== "object" || Array.isArray(value)) return empty;
  const raw = value as Record<string, unknown>;
  const maxPrice = positiveNumber(raw.maxPrice);
  const minBeds = positiveNumber(raw.minBeds);
  const minBaths = positiveNumber(raw.minBaths);
  return {
    ...(maxPrice != null ? { maxPrice } : {}),
    ...(minBeds != null ? { minBeds } : {}),
    ...(minBaths != null ? { minBaths } : {}),
    areas: stringList(raw.areas),
    mustHaves: stringList(raw.mustHaves),
  };
}

export function normalizeWindows(value: unknown): AvailabilityWindow[] {
  if (!Array.isArray(value)) return DEFAULT_AVAILABILITY;
  const windows: AvailabilityWindow[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const weekday = Number(row.weekday);
    const startMin = Number(row.startMin);
    const endMin = Number(row.endMin);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) continue;
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) continue;
    if (startMin < 0 || endMin > 24 * 60 || endMin <= startMin) continue;
    windows.push({ weekday, startMin, endMin });
  }
  return windows.length > 0 ? windows : DEFAULT_AVAILABILITY;
}

function positiveNumber(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

function stringList(value: unknown): string[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const out: string[] = [];
  for (const item of source) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed || out.includes(trimmed)) continue;
    out.push(trimmed.slice(0, 80));
    if (out.length >= 8) break;
  }
  return out;
}

export function preferenceSummary(prefs: BuyerPreferences, wishes: string): string {
  const bits: string[] = [];
  if (prefs.maxPrice) bits.push(`up to $${Math.round(prefs.maxPrice).toLocaleString()}`);
  if (prefs.minBeds) bits.push(`${prefs.minBeds}+ beds`);
  if (prefs.minBaths) bits.push(`${prefs.minBaths}+ baths`);
  if (prefs.areas.length) bits.push(prefs.areas.join(", "));
  if (prefs.mustHaves.length) bits.push(prefs.mustHaves.join(", "));
  const structured = bits.join(" · ");
  const note = wishes.trim();
  if (structured && note) return `${structured}. ${note}`;
  return structured || note || "Wishes saved.";
}

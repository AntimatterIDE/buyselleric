export type HomeSource = "mls" | "manual";

export type AppointmentType = "virtual_call" | "appointment" | "in_person_showing";

export type AppointmentStatus =
  | "requested"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "completed";

export type BuyerPreferences = {
  maxPrice?: number;
  minBeds?: number;
  minBaths?: number;
  areas: string[];
  mustHaves: string[];
};

export type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  wishes: string;
  preferences: BuyerPreferences;
  created_at: string;
  updated_at: string;
};

export type SavedHomeRow = {
  id: string;
  user_id: string;
  source: HomeSource;
  listing_key: string;
  title: string;
  path: string;
  created_at: string;
};

export type AppointmentRow = {
  id: string;
  user_id: string;
  type: AppointmentType;
  status: AppointmentStatus;
  starts_at: string;
  ends_at: string;
  listing_source: string;
  listing_key: string;
  listing_title: string;
  listing_address: string;
  listing_path: string;
  notes: string;
  google_event_id: string | null;
  google_meet_url: string | null;
  admin_note: string;
  created_at: string;
  updated_at: string;
};

export type AvailabilityWindow = {
  weekday: number;
  startMin: number;
  endMin: number;
};

export type EricHomeCard = {
  source: HomeSource;
  listingKey: string;
  title: string;
  path: string;
  priceLabel: string;
  city: string;
  beds: number;
  baths: number;
  imageUrl: string | null;
  address: string;
};

export type EricUiCard =
  | { kind: "homes"; summary: string; href: string; total: number; homes: EricHomeCard[] }
  | { kind: "saved"; saved: boolean; title: string; path: string }
  | { kind: "profile"; summary: string }
  | {
      kind: "appointment";
      id: string;
      type: AppointmentType;
      startsAt: string;
      status: AppointmentStatus;
      title: string;
    };

export type EricThreadMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  cards: EricUiCard[];
  createdAt: string;
};

export const APPOINTMENT_LABELS: Record<AppointmentType, string> = {
  virtual_call: "Virtual call",
  appointment: "Appointment",
  in_person_showing: "In-person showing",
};

export const APPOINTMENT_MINUTES: Record<AppointmentType, number> = {
  virtual_call: 30,
  appointment: 45,
  in_person_showing: 60,
};

export const DEFAULT_AVAILABILITY: AvailabilityWindow[] = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  startMin: 9 * 60,
  endMin: 17 * 60,
}));

export function emptyPreferences(): BuyerPreferences {
  return { areas: [], mustHaves: [] };
}

export function savedHomeComposite(source: HomeSource, listingKey: string): string {
  return `${source}:${listingKey}`;
}

export function listingSaveIdentity(listing: {
  source: "mls" | "manual";
  id: string;
  mls_id: string | null;
}): { source: HomeSource; listingKey: string } {
  if (listing.source === "mls" && listing.mls_id) {
    return { source: "mls", listingKey: listing.mls_id };
  }
  return { source: "manual", listingKey: listing.id };
}

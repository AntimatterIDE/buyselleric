import type { HomeSource } from "@/lib/buyer/types";

/** Only same-site relative paths. Blocks protocol-relative and backslashes. */
export function safeNextPath(value: unknown, fallback = "/account"): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return fallback;
  }
  if (trimmed.startsWith("/admin")) return fallback;
  return trimmed;
}

export function showingRequestHref(input: {
  source: HomeSource;
  listingKey: string;
  title: string;
  address: string;
  path: string;
}): string {
  const params = new URLSearchParams({
    source: input.source,
    key: input.listingKey,
    title: input.title,
    address: input.address,
    path: input.path,
  });
  return `/account/book?${params.toString()}`;
}

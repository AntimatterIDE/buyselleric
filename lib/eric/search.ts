import { applyAmenitiesToFilters } from "@/lib/listing-amenities";
import {
  dreamIntentToSearchParams,
  parseDreamHomeIntent,
  parseDreamHomeIntentHeuristicOnly,
} from "@/lib/dream-home-intent";
import { formatPriceUsd } from "@/lib/format";
import { filterDisplayImageUrls, listingDetailHref } from "@/lib/listing-urls";
import { searchWithFilters, type UnifiedListing } from "@/lib/listings-queries";
import type { EricHomeCard } from "@/lib/buyer/types";

export type EricSearchResult = {
  summary: string;
  href: string;
  total: number;
  homes: EricHomeCard[];
};

export async function searchHomesForEric(prompt: string): Promise<EricSearchResult> {
  const trimmed = prompt.trim().slice(0, 500);
  let intent;
  if (process.env.OPENAI_API_KEY) {
    try {
      intent = await parseDreamHomeIntent(trimmed);
    } catch (err) {
      console.warn("[eric] intent parse failed, using heuristics", err);
      intent = parseDreamHomeIntentHeuristicOnly(trimmed);
    }
  } else {
    intent = parseDreamHomeIntentHeuristicOnly(trimmed);
  }

  const filters = applyAmenitiesToFilters(
    {
      q: intent.filters.q,
      minPrice: intent.filters.minPrice,
      maxPrice: intent.filters.maxPrice,
      minBeds: intent.filters.minBeds,
      minBaths: intent.filters.minBaths,
      minSqft: intent.filters.minSqft,
      maxSqft: intent.filters.maxSqft,
      propertyType: intent.filters.propertyType,
      sort: intent.filters.sort ?? "price_desc",
      page: 1,
      perPage: 4,
      ...(intent.softPrefs.length > 0 ? { softPrefs: intent.softPrefs } : {}),
    },
    intent.amenities,
  );

  const result = await searchWithFilters(filters, { skipAddressGeocode: true });
  const params = dreamIntentToSearchParams(intent, { dreamText: trimmed });
  const qs = params.toString();
  return {
    summary: intent.summary,
    href: qs ? `/listings?${qs}` : "/listings",
    total: result.total,
    homes: result.listings.slice(0, 4).map(toCard),
  };
}

function toCard(listing: UnifiedListing): EricHomeCard {
  const images = filterDisplayImageUrls(listing.image_urls);
  const address = [listing.address_line, listing.city, listing.state].filter(Boolean).join(", ");
  const source = listing.source;
  const listingKey = source === "mls" ? (listing.mls_id ?? listing.id) : listing.id;
  return {
    source,
    listingKey,
    title: listing.title,
    path: listingDetailHref(listing),
    priceLabel: formatPriceUsd(listing.price_cents),
    city: [listing.city, listing.state].filter(Boolean).join(", "),
    beds: listing.bedrooms,
    baths: listing.bathrooms,
    imageUrl: images[0] ?? null,
    address,
  };
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { SaveHomeButton } from "@/components/save-home-button";
import { listingSaveIdentity } from "@/lib/buyer/types";
import { feedLabelForListing } from "@/lib/feed-labels";
import { formatPriceUsd } from "@/lib/format";
import {
  filterDisplayImageUrls,
  listingDetailHref,
  listingImagePreferUnoptimized,
} from "@/lib/listing-urls";
import type { UnifiedListing } from "@/lib/listings-queries";

export function UnifiedListingCard({
  listing,
  saved = false,
}: {
  listing: UnifiedListing;
  saved?: boolean;
}) {
  const imgs = filterDisplayImageUrls(listing.image_urls);
  const location = [listing.city, listing.state].filter(Boolean).join(", ");
  const href = listingDetailHref(listing);
  const feed = feedLabelForListing(listing);
  const identity = listingSaveIdentity(listing);

  const [imgIdx, setImgIdx] = useState(0);
  const img = imgs[imgIdx] ?? null;

  return (
    <article className="group overflow-hidden rounded-2xl border border-border/90 bg-muted/20 shadow-sm transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-lg sm:rounded-3xl">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted sm:aspect-4/3">
        <Link href={href} aria-label={listing.title} className="absolute inset-0">
          {img ? (
            <Image
              key={img}
              src={img}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              loading="lazy"
              unoptimized={listingImagePreferUnoptimized(img)}
              onError={() => {
                if (imgIdx < imgs.length - 1) setImgIdx(imgIdx + 1);
                else setImgIdx(imgs.length);
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-base text-muted-foreground">
              Photo coming soon
            </div>
          )}
        </Link>
        {listing.source === "mls" && (
          <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-ring/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
            MLS
          </span>
        )}
        {feed ? (
          <span
            className={`pointer-events-none absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider shadow-sm ${feed.pillClass}`}
            title={feed.long}
          >
            {feed.short}
          </span>
        ) : null}
        <SaveHomeButton
          source={identity.source}
          listingKey={identity.listingKey}
          title={listing.title}
          path={href}
          initiallySaved={saved}
          returnTo={href}
          label={listing.title}
          className="absolute bottom-3 right-3 z-10"
        />
      </div>
      <Link
        href={href}
        className="block p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-6"
      >
        <p className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">{listing.title}</p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
          {formatPriceUsd(listing.price_cents)}
        </p>
        <p className="mt-3 text-base text-muted-foreground">
          {listing.bedrooms} bd · {listing.bathrooms} ba
          {listing.square_feet ? ` · ${listing.square_feet.toLocaleString()} sq ft` : ""}
        </p>
        {location && <p className="mt-1 text-base text-muted-foreground">{location}</p>}
        {listing.dreamMatchReasons && listing.dreamMatchReasons.length > 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Matches: {listing.dreamMatchReasons.join(", ")}
          </p>
        ) : null}
        {listing.listing_agent && (
          <p className="mt-1 text-sm text-muted-foreground">{listing.listing_agent}</p>
        )}
        <p className="mt-4 text-base font-semibold text-ring underline-offset-4 group-hover:underline sm:mt-5 sm:text-lg">
          View full details →
        </p>
      </Link>
    </article>
  );
}

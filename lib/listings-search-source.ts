/**
 * Controls whether public listing search (grid, map pins, autosuggest, dream
 * candidates) hits live Bridge/Spark OData or Supabase `mls_listings`.
 *
 * Set `LISTINGS_SEARCH_SOURCE=db` when live MLS API credentials are down so
 * results still populate from the synced database. Detail pages can still use
 * Bridge/Spark when those env vars remain set.
 *
 * Values:
 * - `db` — force Supabase for search surfaces
 * - unset / anything else — current behavior (live feeds when configured)
 */
export function preferListingsSearchFromDb(): boolean {
  return process.env.LISTINGS_SEARCH_SOURCE?.trim().toLowerCase() === "db";
}

"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useListingsNavigate } from "@/components/listings-nav-context";
import { SearchSuggestionsList } from "@/components/search-suggestions-list";
import { useListingSearchSuggestions } from "@/components/use-listing-search-suggestions";
import type { SearchSuggestion } from "@/lib/listing-search-suggest";

export function ListingsSearchBar({
  defaultValue = "",
  baseParams,
}: {
  defaultValue?: string;
  /** Preserve map outline, filters, and view when changing the search box (merged with new q). */
  baseParams?: Record<string, string>;
}) {
  const router = useRouter();
  const navigate = useListingsNavigate();
  const [query, setQuery] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { suggestions, loading, runSuggest } = useListingSearchSuggestions();

  useEffect(() => {
    setQuery(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    runSuggest(query);
  }, [query, runSuggest]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [suggestions]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const goSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      setOpen(false);
      const p = new URLSearchParams();
      if (baseParams) {
        for (const [k, v] of Object.entries(baseParams)) {
          if (v && k !== "dream" && k !== "soft") p.set(k, v);
        }
      }
      if (trimmed) p.set("q", trimmed);
      else p.delete("q");
      p.delete("page");
      const qs = p.toString();
      navigate(qs ? `/listings?${qs}` : "/listings", router.push);
    },
    [router, baseParams, navigate],
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const sel = activeIndex >= 0 ? suggestions[activeIndex] : undefined;
    if (sel?.href) {
      setOpen(false);
      navigate(sel.href, router.push);
      return;
    }
    if (sel) {
      goSearch(sel.value);
      return;
    }
    goSearch(query);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open && (suggestions.length > 0 || loading) && query.trim().length >= 2) setOpen(true);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const pick = (s: SearchSuggestion) => {
    if (s.href) {
      setOpen(false);
      navigate(s.href, router.push);
      return;
    }
    setQuery(s.value);
    goSearch(s.value);
  };

  const panelOpen = open && query.trim().length >= 2;

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="w-full">
        <div ref={wrapRef} className="relative">
          <div className="flex items-center gap-2 rounded-full border border-border bg-muted/20 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20 sm:gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3 pl-5 sm:pl-6">
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={onKeyDown}
                placeholder="City, address, or ZIP..."
                className="min-h-[52px] w-full bg-transparent text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-none sm:min-h-[56px] sm:text-lg"
                aria-label="Search listings"
                aria-autocomplete="list"
                aria-expanded={panelOpen}
                aria-controls="listings-search-suggestions"
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              className="mr-2 flex min-h-11 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90 active:scale-[0.97] sm:mr-2.5 sm:px-7 sm:text-base"
            >
              Search
            </button>
          </div>
          {panelOpen ? (
            <div id="listings-search-suggestions">
              <SearchSuggestionsList
                items={suggestions}
                activeIndex={activeIndex}
                onPick={pick}
                loading={loading}
                variant="bar"
              />
            </div>
          ) : null}
        </div>
      </form>
      <Link href="/talk" className="mt-3 inline-flex text-sm font-semibold text-foreground underline-offset-4 hover:underline">
        Talk to Eric about what you want
      </Link>
    </div>
  );
}

"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toggleSavedHome } from "@/app/actions/saved-homes";
import type { HomeSource } from "@/lib/buyer/types";

export function SaveHomeButton({
  source,
  listingKey,
  title,
  path,
  initiallySaved = false,
  returnTo,
  className = "",
  label = "home",
}: {
  source: HomeSource;
  listingKey: string;
  title: string;
  path: string;
  initiallySaved?: boolean;
  returnTo: string;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initiallySaved);
  const [pending, setPending] = useState(false);

  async function onClick() {
    if (pending) return;
    setPending(true);
    const result = await toggleSavedHome({
      source,
      listingKey,
      title,
      path,
      saved,
    });
    setPending(false);
    if (!result.ok && result.needsAuth) {
      router.push(`/account/signup?next=${encodeURIComponent(returnTo)}`);
      return;
    }
    if (result.ok) setSaved(result.saved);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${label} from saved homes` : `Save ${label}`}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md backdrop-blur-sm transition-transform hover:scale-105 active:scale-95 disabled:opacity-60 ${className}`}
    >
      <Heart className={`h-5 w-5 ${saved ? "fill-ring text-ring" : ""}`} aria-hidden />
    </button>
  );
}

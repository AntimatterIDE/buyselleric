"use server";

import { revalidatePath } from "next/cache";
import { BuyerSchemaError, saveHome, unsaveHome } from "@/lib/buyer/data";
import { getBuyer } from "@/lib/buyer/session";
import type { HomeSource } from "@/lib/buyer/types";

export type ToggleSaveResult =
  | { ok: true; saved: boolean }
  | { ok: false; needsAuth: true }
  | { ok: false; needsAuth?: false; message: string };

export async function toggleSavedHome(input: {
  source: HomeSource;
  listingKey: string;
  title: string;
  path: string;
  saved: boolean;
}): Promise<ToggleSaveResult> {
  const buyer = await getBuyer();
  if (!buyer) return { ok: false, needsAuth: true };

  const source = input.source === "manual" ? "manual" : input.source === "mls" ? "mls" : null;
  const listingKey = input.listingKey.trim();
  if (!source || !listingKey) return { ok: false, message: "That home could not be saved." };

  try {
    if (input.saved) {
      await unsaveHome(buyer.supabase, buyer.user.id, source, listingKey);
    } else {
      await saveHome(buyer.supabase, buyer.user.id, {
        source,
        listingKey,
        title: input.title,
        path: input.path,
      });
    }
  } catch (err) {
    if (err instanceof BuyerSchemaError) return { ok: false, message: err.message };
    return { ok: false, message: err instanceof Error ? err.message : "Could not update saved homes." };
  }

  revalidatePath("/account");
  revalidatePath("/listings");
  revalidatePath("/");
  return { ok: true, saved: !input.saved };
}

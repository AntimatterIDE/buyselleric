import { EricChat } from "@/components/eric-chat";
import {
  BuyerSchemaError,
  ensureConversation,
  ensureProfile,
  listEricMessages,
  listSavedHomes,
} from "@/lib/buyer/data";
import { getBuyer } from "@/lib/buyer/session";
import { savedHomeComposite } from "@/lib/buyer/types";
import { createMetadata } from "@/lib/metadata";
import { innerPageMainTopPadding, pageMain, siteContainer } from "@/lib/ui";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Talk to Eric",
  description: "Chat with Eric about homes, your wishes, and booking a call or showing.",
  path: "/talk",
});

export default async function TalkPage(): Promise<ReactNode> {
  const buyer = await getBuyer();
  if (!buyer) redirect("/account/signup?next=/talk");

  let messages: Awaited<ReturnType<typeof listEricMessages>> = [];
  let savedIds: string[] = [];
  let loadError = "";
  try {
    await ensureProfile(buyer.supabase, buyer.user);
    const conversationId = await ensureConversation(buyer.supabase, buyer.user.id);
    const [thread, saved] = await Promise.all([
      listEricMessages(buyer.supabase, conversationId),
      listSavedHomes(buyer.supabase, buyer.user.id),
    ]);
    messages = thread;
    savedIds = saved.map((row) => savedHomeComposite(row.source, row.listing_key));
  } catch (err) {
    loadError = err instanceof BuyerSchemaError ? err.message : "Talk to Eric is not ready yet.";
  }

  if (loadError) {
    return (
      <main id="main-content" className={pageMain} style={innerPageMainTopPadding}>
        <div className={siteContainer}>
          <h1 className="text-3xl font-semibold tracking-tight">Talk to Eric</h1>
          <p className="mt-4 max-w-xl text-muted-foreground">{loadError}</p>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" className={pageMain} style={innerPageMainTopPadding}>
      <div className={`${siteContainer} max-w-3xl`}>
        <EricChat initialMessages={messages} savedIds={savedIds} />
      </div>
    </main>
  );
}

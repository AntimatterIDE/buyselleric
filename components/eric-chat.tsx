"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CartoonEric, type EricExpression } from "@/components/cartoon-eric";
import { SaveHomeButton } from "@/components/save-home-button";
import { formatOfficeDateTime } from "@/lib/buyer/time";
import { APPOINTMENT_LABELS, savedHomeComposite, type EricThreadMessage, type EricUiCard } from "@/lib/buyer/types";
import { listingImagePreferUnoptimized } from "@/lib/listing-urls";

const STARTERS = ["Show me homes", "Update my wishes", "Book a showing"];

export function EricChat({
  initialMessages,
  savedIds,
  openingPrompt = "",
  openerToken = "",
}: {
  initialMessages: EricThreadMessage[];
  savedIds: string[];
  openingPrompt?: string;
  openerToken?: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const opened = useRef(false);
  const last = messages.at(-1);
  const expression = expressionFor(pending, last);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setDraft("");
    setError(null);
    setPending(true);
    const optimistic: EricThreadMessage = {
      id: `local-${(seq.current += 1)}`,
      role: "user",
      content: trimmed,
      cards: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    try {
      const res = await fetch("/api/eric/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: EricThreadMessage | string;
      };
      if (!res.ok || !data.ok || !data.message || typeof data.message === "string") {
        const note = typeof data.message === "string" ? data.message : "Eric could not answer just then.";
        setError(note);
        return;
      }
      setMessages((current) => [...current, data.message as EricThreadMessage]);
    } catch {
      setError("The line to Eric dropped. Try again.");
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    const trimmed = openingPrompt.trim();
    if (!trimmed || !openerToken || opened.current) return;
    opened.current = true;
    const key = `buyselleric:eric-open:${openerToken}`;
    if (sessionStorage.getItem(key)) {
      router.replace("/talk");
      return;
    }
    sessionStorage.setItem(key, "1");
    void send(trimmed);
    router.replace("/talk");
  }, [openingPrompt, openerToken, router]);

  return (
    <div className="flex min-h-[70vh] flex-col rounded-3xl border border-border bg-muted/15">
      <div className="flex items-center gap-3 border-b border-border px-4 py-4 sm:px-6">
        <CartoonEric expression={expression} className="h-16 w-16 shrink-0 text-foreground" />
        <div>
          <p className="text-lg font-semibold tracking-tight text-foreground">Talk to Eric</p>
          <p className="text-sm text-muted-foreground">
            {pending ? "Eric is thinking it through…" : "Homes, wishes, and time on his calendar."}
          </p>
        </div>
      </div>

      <div ref={scroller} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-5 sm:px-6">
        {messages.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center py-8 text-center">
            <CartoonEric expression="listening" className="h-36 w-36 text-foreground" />
            <p className="mt-4 text-xl font-semibold tracking-tight text-foreground">
              Hey. Tell me the home you want.
            </p>
            <p className="mt-2 text-muted-foreground">
              I can search, remember your wishes, save homes, and ask the real Eric to confirm a call or a showing.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className={`max-w-[95%] ${message.role === "user" ? "self-end" : "self-start"}`}
            >
              <div
                className={`rounded-2xl px-4 py-3 text-base leading-relaxed ${
                  message.role === "user"
                    ? "bg-foreground text-background"
                    : "border border-border bg-background text-foreground"
                }`}
              >
                {message.content}
              </div>
              {message.cards.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {message.cards.map((card, index) => (
                    <EricCard key={`${message.id}-${index}`} card={card} savedIds={savedIds} />
                  ))}
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>

      <div className="border-t border-border px-4 py-4 sm:px-6">
        {messages.length === 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {STARTERS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => void send(chip)}
                className="rounded-full border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:border-ring"
              >
                {chip}
              </button>
            ))}
          </div>
        ) : null}
        {error ? <p className="mb-2 text-sm text-red-600 dark:text-red-300">{error}</p> : null}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
          className="flex items-end gap-2"
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Message Eric</span>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send(draft);
                }
              }}
              rows={2}
              placeholder="A 3-bed in Macon under $400k, or book a showing…"
              className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-base text-foreground outline-none focus:border-ring"
            />
          </label>
          <button
            type="submit"
            disabled={pending || draft.trim().length === 0}
            className="inline-flex min-h-12 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

function expressionFor(pending: boolean, last: EricThreadMessage | undefined): EricExpression {
  if (pending) return "thinking";
  const card = last?.role === "assistant" ? last.cards.at(-1) : undefined;
  if (!card) return last ? "listening" : "idle";
  if (card.kind === "appointment") return "booked";
  if (card.kind === "homes" || card.kind === "saved") return "found";
  return "listening";
}

function EricCard({ card, savedIds }: { card: EricUiCard; savedIds: string[] }) {
  if (card.kind === "homes") {
    return (
      <div className="rounded-2xl border border-border bg-background p-3">
        <p className="text-sm text-muted-foreground">
          {card.total.toLocaleString()} {card.total === 1 ? "home" : "homes"}
          {card.summary ? ` · ${card.summary}` : ""}
        </p>
        <ul className="mt-3 space-y-3">
          {card.homes.map((home) => (
            <li key={`${home.source}-${home.listingKey}`} className="flex gap-3">
              <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                {home.imageUrl ? (
                  <Image
                    src={home.imageUrl}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                    unoptimized={listingImagePreferUnoptimized(home.imageUrl)}
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={home.path} className="font-semibold text-foreground hover:underline">
                  {home.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {home.priceLabel} · {home.beds} bd · {home.baths} ba
                  {home.city ? ` · ${home.city}` : ""}
                </p>
              </div>
              <SaveHomeButton
                source={home.source}
                listingKey={home.listingKey}
                title={home.title}
                path={home.path}
                initiallySaved={savedIds.includes(savedHomeComposite(home.source, home.listingKey))}
                returnTo="/talk"
                label={home.title}
              />
            </li>
          ))}
        </ul>
        <Link href={card.href} className="mt-3 inline-flex text-sm font-semibold text-ring hover:underline">
          See the full search
        </Link>
      </div>
    );
  }

  if (card.kind === "saved") {
    return (
      <p className="rounded-2xl border border-ring/30 bg-ring/10 px-4 py-3 text-sm text-foreground">
        {card.saved ? "Saved" : "Removed"}{" "}
        <Link href={card.path} className="font-semibold underline-offset-4 hover:underline">
          {card.title}
        </Link>
      </p>
    );
  }

  if (card.kind === "profile") {
    return (
      <p className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground">
        Wishes updated. {card.summary}{" "}
        <Link href="/account" className="font-semibold underline-offset-4 hover:underline">
          Edit on your profile
        </Link>
      </p>
    );
  }

  return (
    <p className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground">
      {APPOINTMENT_LABELS[card.type]} requested for {formatOfficeDateTime(card.startsAt)}. {card.title}. Eric
      still needs to confirm it.
    </p>
  );
}

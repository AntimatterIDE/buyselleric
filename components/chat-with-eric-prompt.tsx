"use client";

import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CartoonEric } from "@/components/cartoon-eric";

const STARTERS = ["Show me homes", "Update my wishes", "Book a showing"];

export function ChatWithEricPrompt({ variant = "listings" }: { variant?: "hero" | "listings" }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const isHero = variant === "hero";

  function go(text: string) {
    const trimmed = text.trim().slice(0, 500);
    if (!trimmed) {
      router.push("/talk");
      return;
    }
    const params = new URLSearchParams({ prompt: trimmed, t: String(Date.now()) });
    router.push(`/talk?${params.toString()}`);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    go(prompt);
  }

  return (
    <form onSubmit={submit} className="w-full">
      <div
        className={
          isHero
            ? "rounded-3xl border-2 border-foreground/20 bg-background/80 p-3 shadow-lg backdrop-blur-md transition-colors focus-within:border-ring focus-within:shadow-xl sm:p-4"
            : "rounded-2xl border border-border bg-muted/15 p-3 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20 sm:rounded-3xl sm:p-4"
        }
      >
        <div className="mb-2 flex items-center gap-2">
          <CartoonEric
            expression="listening"
            className={isHero ? "h-16 w-16 shrink-0 text-foreground" : "h-12 w-12 shrink-0 text-foreground"}
          />
          <label
            htmlFor={isHero ? "hero-eric-prompt" : "listings-eric-prompt"}
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Chat with Eric
          </label>
        </div>
        <textarea
          id={isHero ? "hero-eric-prompt" : "listings-eric-prompt"}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={isHero ? 3 : 2}
          maxLength={500}
          placeholder='e.g. "Quiet 3-bed near Warner Robins under $400k, modern feel, garage"'
          className={`w-full resize-none bg-transparent text-foreground placeholder:text-muted-foreground/70 focus:outline-none ${
            isHero ? "min-h-[88px] text-base sm:text-lg" : "min-h-[72px] text-base"
          }`}
          aria-label="Chat with Eric"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Eric can find homes, save them, and request a call or showing.
          </p>
          <button
            type="submit"
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90 active:scale-[0.97] sm:px-6 ${
              isHero ? "sm:text-base" : ""
            }`}
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            Chat with Eric
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {STARTERS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => go(chip)}
              className="rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs font-semibold text-foreground hover:border-ring"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}

import Link from "next/link";
import { ctaPrimary, ctaSecondary } from "@/lib/cta-styles";
import { siteConfig } from "@/lib/config";

export function ListingShowingPanel({ href, title }: { href: string; title: string }) {
  return (
    <div id="inquiry" className="rounded-2xl border border-border/70 bg-muted/15 p-6 sm:rounded-3xl sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">With Eric</p>
      <h2 className="mt-2 text-xl font-semibold text-foreground sm:text-2xl">See this home</h2>
      <p className="mt-2 max-w-xl text-base text-muted-foreground">
        Request a showing, a call, or a sit-down about {title}. Eric confirms the time before it is booked.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href={href} className={ctaPrimary}>
          Request a showing
        </Link>
        <a href={`tel:${siteConfig.phoneTel}`} className={ctaSecondary}>
          Call {siteConfig.phoneDisplay}
        </a>
      </div>
    </div>
  );
}

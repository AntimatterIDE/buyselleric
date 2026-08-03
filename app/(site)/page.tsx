import { FeaturedListings } from "@/components/featured-listings";
import { HeroLoader } from "@/components/hero-loader";
import { LazySection } from "@/components/lazy-section";
import { siteConfig } from "@/lib/config";
import { createMetadata } from "@/lib/metadata";
import { siteImages } from "@/lib/site-images";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const Services = dynamic(() => import("@/components/services").then((m) => ({ default: m.Services })));
const SocialProof = dynamic(() =>
  import("@/components/social-proof").then((m) => ({ default: m.SocialProof })),
);
const Faq = dynamic(() => import("@/components/faq").then((m) => ({ default: m.Faq })));

export const metadata: Metadata = createMetadata({
  title: `${siteConfig.name} · ${siteConfig.agentName}`,
  description: siteConfig.description,
  path: "/",
});

export default function HomePage(): ReactNode {
  return (
    <main id="main-content" className="relative z-10 w-full flex-1 bg-background">
      {/* RSC preload — single format to avoid double-download with <picture> */}
      <link rel="preload" as="image" href={siteImages.heroPoster} fetchPriority="high" />
      {/* Calm, cool hover animations for homepage buttons */}
      <style>{`
        #main-content a,
        #main-content button {
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
                      box-shadow 0.25s ease,
                      background-color 0.25s ease,
                      color 0.25s ease,
                      border-color 0.25s ease;
          will-change: transform;
        }
        #main-content a:hover,
        #main-content button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
        }
        #main-content a:active,
        #main-content button:active {
          transform: translateY(0px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }
      `}</style>
      <HeroLoader />
      <FeaturedListings />
      {/* Eager mount: hash links (#services) must exist on first paint for scroll + Lenis. */}
      <Services />
      <LazySection>
        <SocialProof />
      </LazySection>
      <LazySection>
        <Faq />
      </LazySection>
    </main>
  );
}
import { AccountAuthForm } from "@/components/account-auth-form";
import { safeNextPath } from "@/lib/buyer/paths";
import { getBuyer } from "@/lib/buyer/session";
import { createMetadata } from "@/lib/metadata";
import { eyebrow, innerPageMainTopPadding, lead, pageMain, sectionTitle, siteContainer } from "@/lib/ui";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Log in",
  description: "Log in to your BuySellEric account.",
  path: "/account/login",
  noIndex: true,
});

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}): Promise<ReactNode> {
  const buyer = await getBuyer();
  const params = await searchParams;
  const nextPath = safeNextPath(params.next, "/account");
  if (buyer) redirect(nextPath);

  return (
    <main id="main-content" className={pageMain} style={innerPageMainTopPadding}>
      <div className={`${siteContainer} max-w-xl`}>
        <p className={eyebrow}>BuySellEric</p>
        <h1 className={`${sectionTitle} mt-3`}>Log in</h1>
        <p className={`${lead} mt-4`}>Your wishes, saved homes, and time with Eric live here.</p>
        <AccountAuthForm mode="login" nextPath={nextPath} />
      </div>
    </main>
  );
}

import { AccountAuthForm } from "@/components/account-auth-form";
import { CartoonEric } from "@/components/cartoon-eric";
import { safeNextPath } from "@/lib/buyer/paths";
import { getBuyer } from "@/lib/buyer/session";
import { createMetadata } from "@/lib/metadata";
import { eyebrow, innerPageMainTopPadding, lead, pageMain, sectionTitle, siteContainer } from "@/lib/ui";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Create your account",
  description: "Create a BuySellEric account to save homes, keep your wishes, and talk to Eric.",
  path: "/account/signup",
  noIndex: true,
});

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}): Promise<ReactNode> {
  const buyer = await getBuyer();
  const params = await searchParams;
  const nextPath = safeNextPath(params.next, "/account?welcome=1");
  if (buyer) redirect(nextPath);

  return (
    <main id="main-content" className={pageMain} style={innerPageMainTopPadding}>
      <div className={`${siteContainer} max-w-xl`}>
        <CartoonEric expression="listening" className="h-28 w-28 text-foreground" />
        <p className={`${eyebrow} mt-4`}>BuySellEric</p>
        <h1 className={`${sectionTitle} mt-3`}>Create your account</h1>
        <p className={`${lead} mt-4`}>
          Then you can tell Eric what you want, save homes, and ask him to set up a call or a showing.
        </p>
        <AccountAuthForm mode="signup" nextPath={nextPath} />
      </div>
    </main>
  );
}

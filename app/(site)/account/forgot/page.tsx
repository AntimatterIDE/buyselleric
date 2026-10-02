import { AccountForgotForm } from "@/components/account-forgot-form";
import { getBuyer } from "@/lib/buyer/session";
import { createMetadata } from "@/lib/metadata";
import { eyebrow, innerPageMainTopPadding, lead, pageMain, sectionTitle, siteContainer } from "@/lib/ui";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Reset your password",
  description: "Email yourself a link to choose a new BuySellEric password.",
  path: "/account/forgot",
  noIndex: true,
});

export default async function ForgotPasswordPage(): Promise<ReactNode> {
  const buyer = await getBuyer();
  if (buyer) redirect("/account");

  return (
    <main id="main-content" className={pageMain} style={innerPageMainTopPadding}>
      <div className={`${siteContainer} max-w-xl`}>
        <p className={eyebrow}>BuySellEric</p>
        <h1 className={`${sectionTitle} mt-3`}>Reset your password</h1>
        <p className={`${lead} mt-4`}>Eric will email you a link to choose a new one.</p>
        <AccountForgotForm />
      </div>
    </main>
  );
}

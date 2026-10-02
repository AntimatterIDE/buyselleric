import { AccountResetForm } from "@/components/account-reset-form";
import { getBuyer } from "@/lib/buyer/session";
import { createMetadata } from "@/lib/metadata";
import { eyebrow, innerPageMainTopPadding, lead, pageMain, sectionTitle, siteContainer } from "@/lib/ui";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Choose a new password",
  description: "Choose a new password for your BuySellEric account.",
  path: "/account/reset",
  noIndex: true,
});

export default async function ResetPasswordPage(): Promise<ReactNode> {
  const buyer = await getBuyer();

  return (
    <main id="main-content" className={pageMain} style={innerPageMainTopPadding}>
      <div className={`${siteContainer} max-w-xl`}>
        <p className={eyebrow}>BuySellEric</p>
        <h1 className={`${sectionTitle} mt-3`}>Choose a new password</h1>
        {buyer ? (
          <>
            <p className={`${lead} mt-4`}>This replaces the password on your account.</p>
            <AccountResetForm />
          </>
        ) : (
          <p className={`${lead} mt-4`}>
            Open the reset link from your email, then come back here.{" "}
            <Link href="/account/forgot" className="font-semibold text-foreground underline-offset-4 hover:underline">
              Send a new link
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}

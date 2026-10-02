"use client";

import { useActionState } from "react";
import { requestPasswordReset, type AuthFormState } from "@/app/actions/account";
import { accountFieldClass, accountLabelClass } from "@/components/account-field";
import { ctaPrimary } from "@/lib/cta-styles";
import Link from "next/link";

export function AccountForgotForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(requestPasswordReset, null);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <label className="block">
        <span className={accountLabelClass}>Email</span>
        <input name="email" type="email" required autoComplete="email" className={accountFieldClass} />
      </label>
      {state?.ok === false ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {state.message}
        </p>
      ) : null}
      {state?.ok === true ? (
        <p className="rounded-xl border border-ring/40 bg-ring/10 px-4 py-3 text-sm text-foreground">{state.message}</p>
      ) : null}
      <button type="submit" disabled={pending} className={`${ctaPrimary} w-full sm:w-full`}>
        {pending ? "One moment…" : "Email me a reset link"}
      </button>
      <p className="text-sm text-muted-foreground">
        <Link href="/account/login" className="font-semibold text-foreground underline-offset-4 hover:underline">
          Back to log in
        </Link>
      </p>
    </form>
  );
}

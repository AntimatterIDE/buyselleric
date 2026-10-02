"use client";

import { useActionState } from "react";
import { updatePassword, type AuthFormState } from "@/app/actions/account";
import { accountFieldClass, accountLabelClass } from "@/components/account-field";
import { ctaPrimary } from "@/lib/cta-styles";

export function AccountResetForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(updatePassword, null);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <label className="block">
        <span className={accountLabelClass}>New password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={accountFieldClass}
        />
      </label>
      <label className="block">
        <span className={accountLabelClass}>Confirm password</span>
        <input
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={accountFieldClass}
        />
      </label>
      {state?.ok === false ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {state.message}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={`${ctaPrimary} w-full sm:w-full`}>
        {pending ? "One moment…" : "Save password"}
      </button>
    </form>
  );
}

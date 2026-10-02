"use client";

import { useActionState } from "react";
import { signInAccount, signUpAccount, type AuthFormState } from "@/app/actions/account";
import { accountFieldClass, accountLabelClass } from "@/components/account-field";
import { ctaPrimary } from "@/lib/cta-styles";
import Link from "next/link";

export function AccountAuthForm({
  mode,
  nextPath,
}: {
  mode: "login" | "signup";
  nextPath: string;
}) {
  const action = mode === "signup" ? signUpAccount : signInAccount;
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, null);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <input type="hidden" name="next" value={nextPath} />
      {mode === "signup" ? (
        <label className="block">
          <span className={accountLabelClass}>Name</span>
          <input name="full_name" required autoComplete="name" className={accountFieldClass} />
        </label>
      ) : null}
      <label className="block">
        <span className={accountLabelClass}>Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className={accountFieldClass}
        />
      </label>
      <label className="block">
        <span className={accountLabelClass}>Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className={accountFieldClass}
        />
      </label>
      {mode === "login" ? (
        <p className="text-sm">
          <Link href="/account/forgot" className="font-semibold text-foreground underline-offset-4 hover:underline">
            Forgot password?
          </Link>
        </p>
      ) : null}
      {state?.ok === false ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {state.message}
        </p>
      ) : null}
      {state?.ok === true ? (
        <p className="rounded-xl border border-ring/40 bg-ring/10 px-4 py-3 text-sm text-foreground">
          {state.message}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={`${ctaPrimary} w-full sm:w-full`}>
        {pending ? "One moment…" : mode === "signup" ? "Create account" : "Log in"}
      </button>
      <p className="text-sm text-muted-foreground">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href={`/account/login?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-foreground underline-offset-4 hover:underline">
              Log in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href={`/account/signup?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-foreground underline-offset-4 hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}

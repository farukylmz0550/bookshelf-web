// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginForm({ dict }: { dict: Record<string, string> }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // v2.10.0 — TOTP: the form stays on one screen; authorize() answers with
  // TOTP_REQUIRED, the code field appears, and the same submit re-sends the
  // stored email/password together with the six-digit code.
  const [needsTotp, setNeedsTotp] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const email = form.get("email");
    const password = form.get("password");
    const totp = form.get("totp");

    const result = await signIn("credentials", {
      email,
      password,
      totp: needsTotp ? totp : undefined,
      redirect: false,
    });

    setPending(false);
    if (result?.error) {
      if (result.error === "TOTP_REQUIRED") {
        setNeedsTotp(true);
        setError(dict.totpRequired);
        return;
      }
      if (result.error === "INVALID_TOTP") {
        setError(dict.invalidTotp);
        return;
      }
      if (result.error === "APPROVAL_PENDING") {
        setError(dict.approvalPending);
        return;
      }
      // Wrong TOTP code invalidates the whole credentials attempt — go back
      // to the password step with a fresh state.
      if (needsTotp && (result.error === "CredentialsSignin" || result.error === "AccessDeniedError")) {
        setNeedsTotp(false);
        formRef.current?.reset();
      }
      setError(dict.invalidCredentials);
      return;
    }
    router.push("/books");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Book Shelf" className="mb-3 h-20 w-20" />
          <h1 className="text-xl font-semibold text-foreground">Book Shelf</h1>
          <p className="mt-1 text-xs text-muted-foreground">Your library manager</p>
        </div>
        <form
          ref={formRef}
          method="POST"
          onSubmit={handleSubmit}
          className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-6"
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-foreground">{dict.email}</label>
              <input
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-foreground">{dict.password}</label>
              <input
                name="password"
                type="password"
                placeholder="••••••••"
                required
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {needsTotp && (
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-foreground">{dict.totpCode}</label>
                <input
                  name="totp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  maxLength={6}
                  pattern="[0-9]*"
                  required
                  autoFocus
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-center font-mono text-lg tracking-[0.3em] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
            {error && <div className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {pending ? dict.signingIn : dict.loginCta}
            </button>
          </div>
        </form>
        <p className="mt-4 text-center text-[13px] text-muted-foreground">
          {dict.noAccount}{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            {dict.createOne}
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">{dict.forgotPassword}</p>
      </div>
    </div>
  );
}

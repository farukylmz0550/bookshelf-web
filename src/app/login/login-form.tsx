// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginForm({ dict }: { dict: Record<string, string> }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);

    const result = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });

    setPending(false);
    if (result?.error) {
      if (result.error === "APPROVAL_PENDING") {
        setError(dict.approvalPending);
      } else {
        setError(dict.invalidCredentials);
      }
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
      </div>
    </div>
  );
}

// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState } from "react";
import Link from "next/link";
import { registerUser } from "@/app/actions/auth";

export default function RegisterForm({ dict }: { dict: Record<string, string> }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);

    const result = await registerUser({
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });

    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Book Shelf" className="mb-3 h-20 w-20" />
            <h1 className="text-xl font-semibold text-foreground">Book Shelf</h1>
          </div>
          <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
            <p className="text-sm text-foreground">{dict.registrationSuccess}</p>
            <p className="mt-2 text-xs text-muted-foreground">{dict.approvalRequired}</p>
            <Link
              href="/login"
              className="mt-4 inline-block rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground"
            >
              {dict.goToLogin}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Book Shelf" className="mb-3 h-20 w-20" />
          <h1 className="text-xl font-semibold text-foreground">Book Shelf</h1>
          <p className="mt-1 text-xs text-muted-foreground">Create account</p>
        </div>
        <form
          method="POST"
          onSubmit={handleSubmit}
          className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-6"
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-foreground">{dict.name}</label>
              <input
                name="name"
                placeholder={dict.name}
                required
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
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
                placeholder={dict.minChars}
                required
                minLength={8}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {error && <div className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {pending ? dict.creating : dict.registerCta}
            </button>
          </div>
        </form>
        <p className="mt-4 text-center text-[13px] text-muted-foreground">
          {dict.haveAccount}{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {dict.signIn}
          </Link>
        </p>
      </div>
    </div>
  );
}

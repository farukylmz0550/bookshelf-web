// SPDX-License-Identifier: GPL-3.0-only
"use client";

// v3.14.0 — TOTP second factor moved into its own popup (PopupShell) with the
// shared TotpCodeInput (six boxes, auto-advance, paste). When authorize()
// answers TOTP_REQUIRED the popup opens and re-submits the stored
// credentials + code in one signIn call — the same single-auth-system
// lifecycle as before, only a better entry surface. Auto-submit fires when
// the sixth digit lands; a wrong code re-opens with the boxes cleared.

import { useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TotpCodeInput } from "@/components/ui/totp-input";
import { PopupShell } from "@/components/ui/popup";
import { Button } from "@/components/ui/button";

export default function LoginForm({ dict }: { dict: Record<string, string> }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // v2.10.0 — TOTP: authorize() answers TOTP_REQUIRED; since v3.14.0 the code
  // entry lives in a popup with the shared TotpCodeInput instead of an inline
  // field on the login card.
  const [needsTotp, setNeedsTotp] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [totpInvalid, setTotpInvalid] = useState(false);
  // Credentials are stashed when TOTP_REQUIRED lands (inside attempt); the
  // popup's submit re-sends them together with the code.
  const credsRef = useRef<{ email: string; password: string } | null>(null);
  async function attempt(email: FormDataEntryValue | null, password: FormDataEntryValue | null, totp?: string) {
    setPending(true);
    setError(null);
    const result = await signIn("credentials", {
      email,
      password,
      totp,
      redirect: false,
    });
    setPending(false);
    if (result?.error) {
      if (result.error === "TOTP_REQUIRED") {
        // v3.14.0 — open the TOTP popup with the credentials stashed; the
        // popup's submit re-sends them + the code in the same signIn path.
        credsRef.current = {
          email: typeof email === "string" ? email : "",
          password: typeof password === "string" ? password : "",
        };
        setTotpCode("");
        setTotpInvalid(false);
        setNeedsTotp(true);
        setError(dict.totpRequired);
        return;
      }
      // v3.11.2 — throttle hit: explain the wait instead of pretending the
      // password was wrong; the code entry stays open for a single retry
      // after the window.
      if (result.error === "TOTP_THROTTLED") {
        setError(dict.totpThrottled);
        return;
      }
      if (result.error === "INVALID_TOTP") {
        setTotpInvalid(true);
        setTotpCode("");
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
        setTotpCode("");
        credsRef.current = null;
        formRef.current?.reset();
      }
      setError(dict.invalidCredentials);
      return;
    }
    router.push("/books");
    router.refresh();
  }

  // The popup's own submit: same credentials + the assembled TOTP code.
  function handleTotpSubmit(code: string) {
    const creds = credsRef.current;
    if (!creds || code.length !== 6) return;
    void attempt(creds.email, creds.password, code);
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
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            void attempt(form.get("email"), form.get("password"));
          }}
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
        <p className="mt-2 text-center text-xs text-muted-foreground">{dict.forgotPassword}</p>
      </div>

      {needsTotp && (
        <PopupShell open onOpenChange={() => undefined} title={dict.totpCode} description={dict.totpRequired}>
          <div className="space-y-4">
            <TotpCodeInput
              value={totpCode}
              onChange={(v) => {
                setTotpCode(v);
                setTotpInvalid(false);
              }}
              onComplete={(code) => handleTotpSubmit(code)}
              disabled={pending}
              invalid={totpInvalid}
              ariaLabel={dict.totpCode}
              autoFocus
            />
            {error && <div className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <Button
              onClick={() => handleTotpSubmit(totpCode)}
              disabled={pending || totpCode.length !== 6}
              className="w-full"
            >
              {pending ? dict.signingIn : dict.loginCta}
            </Button>
          </div>
        </PopupShell>
      )}
    </div>
  );
}

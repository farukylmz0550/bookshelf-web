// SPDX-License-Identifier: GPL-3.0-only
"use client";

// v3.12.0 — the explicit confirmation step of QR login. Scanning NEVER
// authenticates: the user sees the account about to be signed in and must
// press [Sign in]; [Cancel] goes back to the login page and the token is
// simply left to expire.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmQrLogin } from "@/app/actions/qr-login";

type PairDict = {
  title: string;
  accountLabel: string;
  deviceLabel: string;
  signCta: string;
  cancelCta: string;
  confirming: string;
  invalid: string;
  rateLimited: string;
};

/** Display-only device summary — not security-relevant. */
function deviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) {
    const model = ua.match(/Android [\d.]+; ([^;)]+)[;)]/i)?.[1];
    return model ? `Android · ${model.trim()}` : "Android";
  }
  const withData = navigator as Navigator & { userAgentData?: { platform?: string } };
  return withData.userAgentData?.platform || navigator.platform || "Browser";
}

export function PairConfirm({ token, accountEmail, dict }: { token: string; accountEmail: string; dict: PairDict }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<string>("");

  useEffect(() => {
    // Deferred (not synchronous) — avoids cascading render on mount.
    const id = setTimeout(() => setDevice(deviceLabel()), 0);
    return () => clearTimeout(id);
  }, []);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await confirmQrLogin(token);
      if (!res.ok) {
        setError(res.error === "RATE_LIMITED" ? dict.rateLimited : dict.invalid);
        return;
      }
      // The session cookie is set by the action — refresh server components
      // and land in the library.
      router.push("/books");
      router.refresh();
    });
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="mb-4 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" className="mb-3 h-16 w-16" />
          <h1 className="font-[var(--font-serif)] text-lg font-semibold text-foreground">{dict.title}</h1>
        </div>
        <div className="space-y-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-[var(--font-sans)] text-xs text-muted-foreground">{dict.accountLabel}</span>
            <span className="min-w-0 truncate font-[var(--font-sans)] text-sm font-medium text-foreground">
              {accountEmail}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-[var(--font-sans)] text-[13px] text-muted-foreground">{dict.deviceLabel}</span>
            <span className="flex items-center gap-1.5 font-[var(--font-sans)] text-sm text-foreground">
              <Monitor size={14} className="text-muted-foreground" />
              {device || "—"}
            </span>
          </div>
        </div>
        {error && <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="mt-4 flex gap-2">
          <Button onClick={confirm} disabled={pending} className="flex-1 gap-2">
            <BookOpenCheck size={16} />
            {pending ? dict.confirming : dict.signCta}
          </Button>
          <Button variant="outline" disabled={pending} onClick={() => router.push("/login")}>
            {dict.cancelCta}
          </Button>
        </div>
      </div>
    </main>
  );
}

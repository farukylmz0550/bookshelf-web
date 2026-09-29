// SPDX-License-Identifier: GPL-3.0-only

// v3.12.0 — the phone-side page a scanned QR opens (public per proxy.ts).
// Scanning alone never authenticates: this page looks the session up (marks
// it scanned without consuming it) and shows a confirmation screen — the
// account that will be signed in. Only [Sign in] consumes the token
// (atomically) and issues the session.

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hashQrToken } from "@/lib/qr-login";
import { getDictionary } from "@/i18n/get-dictionary";
import { PairConfirm } from "./pair-confirm";

export default async function PairPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await auth();
  // Already signed in on this device — nothing to pair.
  if (session?.user?.id) redirect("/books");

  const dict = await getDictionary();

  // Generic rejection for unknown / used / expired — a single message, no
  // attacker-useful distinction.
  if (typeof token === "string" && token.length > 0 && token.length <= 128) {
    const row = await db.qrLoginSession.findUnique({
      where: { tokenHash: hashQrToken(token) },
      select: { confirmedAt: true, expiresAt: true, user: { select: { email: true } } },
    });
    if (row && !row.confirmedAt && row.expiresAt >= new Date()) {
      await db.qrLoginSession.updateMany({
        where: { tokenHash: hashQrToken(token), confirmedAt: null },
        data: { scannedAt: new Date() },
      });
      return (
        <PairConfirm
          token={token}
          accountEmail={row.user.email}
          dict={{
            title: dict.qrLogin.pairTitle,
            accountLabel: dict.qrLogin.pairAccount,
            deviceLabel: dict.qrLogin.pairDevice,
            signCta: dict.qrLogin.pairSignCta,
            cancelCta: dict.qrLogin.pairCancelCta,
            confirming: dict.auth.signingIn,
            invalid: dict.qrLogin.pairInvalid,
            rateLimited: dict.qrLogin.pairRateLimited,
          }}
        />
      );
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
        <h1 className="font-[var(--font-serif)] text-lg font-semibold text-foreground">{dict.qrLogin.pairTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{dict.qrLogin.pairInvalid}</p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {dict.auth.login}
        </Link>
      </div>
    </main>
  );
}

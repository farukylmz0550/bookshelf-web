// SPDX-License-Identifier: GPL-3.0-only
"use client";

// v3.14.0 — QR login card for Settings → Security. The card is now just a
// trigger: the whole generation flow lives in its own popup (PopupShell —
// see ui/popup.tsx for the approved popup locations). Opening the popup
// auto-generates a session; the token TTL is 30 s and the QR renews
// AUTOMATICALLY when it expires (the visible code is always in-window).
// The lifecycle stays single-use + atomic-claim (lib/qr-login.ts).

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { QrCode, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PopupShell } from "@/components/ui/popup";
import QRCode from "qrcode";
import { cancelQrLoginSession, createQrLoginSession, getQrLoginStatus } from "@/app/actions/qr-login";

export type QrLoginDict = {
  cardTitle: string;
  cardDesc: string;
  generateCta: string;
  regenerateCta: string;
  waiting: string;
  scanned: string;
  completed: string;
  expired: string;
  cancelled: string;
  completedToast: string;
  errorToast: string;
};

type Phase = "idle" | "pending" | "scanned" | "completed" | "expired" | "cancelled";

export function QrLoginCard({ dict }: { dict: QrLoginDict }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [remaining, setRemaining] = useState(0);
  const [pending, startTransition] = useTransition();

  // Only the hash's owning session id is kept client-side — the raw token is
  // never stored beyond the QR render.
  const sessionRef = useRef<{ sessionId: string; token: string; expiresAt: number } | null>(null);

  function generate() {
    setQrDataUrl(null);
    setPhase("pending");
    startTransition(async () => {
      // A previous unfinished session is cancelled so it can't be confirmed later.
      const previous = sessionRef.current;
      if (previous && previous.sessionId) {
        await cancelQrLoginSession(previous.sessionId).catch(() => {});
      }
      const res = await createQrLoginSession();
      if (!res.ok) {
        setPhase("idle");
        toast.error(res.error);
        return;
      }
      const expiresAt = new Date(res.expiresAt).getTime();
      sessionRef.current = { sessionId: res.sessionId, token: res.token, expiresAt };
      setRemaining(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
      const dataUrl = await QRCode.toDataURL(res.url, { margin: 1, width: 220 });
      setQrDataUrl(dataUrl);
    });
  }

  // v3.14.0 — auto-renew: when the popup's open session expires, a fresh token
  // is generated without user action, so the QR never sits stale on screen.
  // Manual regenerate stays available as a fallback control.
  useEffect(() => {
    if (phase !== "expired" || !open) return;
    const renew = setTimeout(generate, 600);
    return () => clearTimeout(renew);
  }, [phase, open]);

  // Closing the popup cancels the open session — a half-issued token must not
  // stay confirmable in the wild.
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      const previous = sessionRef.current;
      if (previous && previous.sessionId && (phase === "pending" || phase === "scanned" || phase === "expired")) {
        void cancelQrLoginSession(previous.sessionId).catch(() => {});
        sessionRef.current = null;
      }
      setPhase("idle");
      setQrDataUrl(null);
    }
  }

  // Countdown tick — display only; the server enforces expiry.
  useEffect(() => {
    if (phase !== "pending" && phase !== "scanned") return;
    const timer = setInterval(() => {
      const msLeft = (sessionRef.current?.expiresAt ?? 0) - Date.now();
      setRemaining(Math.max(0, Math.ceil(msLeft / 1000)));
    }, 500);
    return () => clearInterval(timer);
  }, [phase]);

  // Poll the server-side state — the source of truth for scanned/completed.
  useEffect(() => {
    if (!open) return;
    if (phase !== "pending" && phase !== "scanned") return;
    let cancelled = false;
    const poll = setInterval(async () => {
      const session = sessionRef.current;
      if (!session) return;
      if (session.expiresAt <= Date.now()) {
        if (!cancelled) setPhase("expired");
        return;
      }
      const res = await getQrLoginStatus(session.sessionId);
      if (cancelled) return;
      if (!res.ok) {
        if (res.error === "EXPIRED") setPhase("expired");
        else setPhase("cancelled");
        return;
      }
      if (res.state === "scanned") setPhase("scanned");
      if (res.state === "confirmed") {
        setPhase("completed");
        toast.success(dict.completedToast);
        router.refresh();
      }
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [open, phase, dict.completedToast, router]);

  const busy = phase === "pending" && pending && !qrDataUrl;

  return (
    <section>
      <h2 className="mb-2 px-1 font-[var(--font-sans)] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {dict.cardTitle}
      </h2>
      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="mb-3 font-[var(--font-sans)] text-sm text-muted-foreground">{dict.cardDesc}</p>
        <div className="flex justify-center">
          <Button onClick={() => handleOpenChange(true)} className="gap-2">
            <QrCode size={16} />
            {dict.generateCta}
          </Button>
        </div>
      </div>

      <PopupShell open={open} onOpenChange={handleOpenChange} title={dict.cardTitle} description={dict.cardDesc}>
        {qrDataUrl ? (
          <div className="flex flex-col items-center gap-3 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt={dict.cardTitle}
              className={`h-48 w-48 rounded-[12px] border border-[var(--border)] bg-white p-2 transition-opacity ${
                phase === "completed" ? "opacity-30" : ""
              }`}
            />
            <div className="flex items-center gap-2 font-[var(--font-sans)] text-sm">
              {phase === "completed" ? (
                <span className="flex items-center gap-1.5 text-[var(--success-text)]">
                  <CheckCircle2 size={15} /> {dict.completed}
                </span>
              ) : phase === "expired" ? (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <RefreshCw size={14} className="animate-spin" /> {dict.regenerateCta}…
                </span>
              ) : phase === "scanned" ? (
                <span className="text-foreground">{dict.scanned}</span>
              ) : (
                <span className="text-muted-foreground">{dict.waiting}</span>
              )}
              {(phase === "pending" || phase === "scanned") && (
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{remaining}s</span>
              )}
            </div>
          </div>
        ) : busy ? (
          <div className="flex h-48 w-48 mx-auto items-center justify-center text-sm text-muted-foreground">…</div>
        ) : (
          <div className="flex justify-center py-6">
            <Button onClick={generate} disabled={pending} className="gap-2">
              <QrCode size={16} />
              {dict.generateCta}
            </Button>
          </div>
        )}
      </PopupShell>
    </section>
  );
}

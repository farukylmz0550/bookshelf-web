// SPDX-License-Identifier: GPL-3.0-only
"use client";

// v2.10.0 — TOTP enrollment/disable UI. Shared between the Settings page
// (SecuritySettings card) and the mandatory-admin gate (TotpSetupFlow).

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { startTotpEnrollment, verifyTotpEnrollment, disableTotp } from "@/app/actions/security";

export type SecurityDict = {
  securityTitle: string;
  securityDesc: string;
  totpOn: string;
  totpOff: string;
  enableCta: string;
  disableCta: string;
  verifyCta: string;
  scanHint: string;
  totpCode: string;
  invalidCode: string;
  rateLimited: string;
  setupToast: string;
  disableToast: string;
  adminRequired: string;
};

function actionError(code: string, dict: SecurityDict): string {
  if (code === "INVALID_CODE") return dict.invalidCode;
  if (code === "RATE_LIMITED") return dict.rateLimited;
  if (code === "ADMIN_REQUIRED") return dict.adminRequired;
  return dict.invalidCode;
}

// Shared enrollment body: secret + QR + six-digit verification input.
export function TotpSetupFlow({ dict, onActivated }: { dict: SecurityDict; onActivated: () => void }) {
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string>("");
  const [token, setToken] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    startTotpEnrollment().then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.ok) {
        setQrDataUrl(res.qrDataUrl);
        setSecret(res.secret);
      } else {
        toast.error(res.error === "RATE_LIMITED" ? dict.rateLimited : dict.invalidCode);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    if (verifying || token.trim().length !== 6) return;
    setVerifying(true);
    const res = await verifyTotpEnrollment(token);
    setVerifying(false);
    if (res.ok) {
      toast.success(dict.setupToast);
      startTransition(() => router.refresh());
      onActivated();
    } else {
      toast.error(actionError(res.error, dict));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {qrDataUrl && (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="TOTP QR code" className="h-[220px] w-[220px] rounded-[8px] bg-white p-2" />
        </div>
      )}
      <p className="font-[var(--font-sans)] text-xs text-muted-foreground">{dict.scanHint}</p>
      <input
        readOnly
        value={secret}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Secret"
        className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 font-[var(--font-mono)] text-xs tracking-wider text-foreground"
      />
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={token}
          onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="123456"
          maxLength={6}
          className="w-32 rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-center font-[var(--font-mono)] text-sm tracking-[0.25em] text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <Button onClick={submit} disabled={verifying || token.length !== 6}>
          {verifying && <Loader2 className="size-4 animate-spin" />}
          {dict.verifyCta}
        </Button>
      </div>
    </div>
  );
}

export function SecuritySettings({
  totpEnabled,
  isAdmin,
  dict,
}: {
  totpEnabled: boolean;
  isAdmin: boolean;
  dict: SecurityDict;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"enable" | "disable" | null>(null);
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();

  async function submitDisable() {
    if (pending || token.length !== 6) return;
    setPending(true);
    const res = await disableTotp(token);
    setPending(false);
    if (res.ok) {
      toast.success(dict.disableToast);
      setDialog(null);
      setToken("");
      startTransition(() => router.refresh());
    } else {
      toast.error(actionError(res.error, dict));
    }
  }

  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-[var(--font-serif)] text-sm font-semibold text-foreground">{dict.securityTitle}</h2>
          <p className="mt-0.5 font-[var(--font-sans)] text-xs text-muted-foreground">{dict.securityDesc}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 font-[var(--font-sans)] text-[11px] font-medium ${
            totpEnabled
              ? "bg-[var(--success-soft)] text-[var(--success-text)]"
              : "bg-[var(--surface-elevated)] border border-[var(--border)] text-muted-foreground"
          }`}
        >
          {totpEnabled ? dict.totpOn : dict.totpOff}
        </span>
      </div>
      <div className="mt-3">
        {totpEnabled ? (
          <Button variant="outline" size="sm" onClick={() => setDialog("disable")} disabled={isAdmin}>
            <ShieldOff size={14} />
            {dict.disableCta}
          </Button>
        ) : (
          <Button size="sm" onClick={() => setDialog("enable")}>
            <ShieldCheck size={14} />
            {dict.enableCta}
          </Button>
        )}
      </div>

      {dialog === "enable" && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{dict.securityTitle}</DialogTitle>
            </DialogHeader>
            <TotpSetupFlow
              dict={dict}
              onActivated={() => {
                setDialog(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {dialog === "disable" && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{dict.disableCta}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="font-[var(--font-sans)] text-sm text-muted-foreground">{dict.scanHint}</p>
              <input
                type="text"
                inputMode="numeric"
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                className="w-32 rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-center font-[var(--font-mono)] text-sm tracking-[0.25em] text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)}>
                {dict.totpOff}
              </Button>
              <Button variant="destructive" onClick={submitDisable} disabled={pending || token.length !== 6}>
                {dict.disableCta}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}

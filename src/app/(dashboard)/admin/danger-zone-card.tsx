// SPDX-License-Identifier: GPL-3.0-only
"use client";

// v2.10.0 — admin danger zone: deletes every non-admin account (with all of
// their data) behind the caller's fresh TOTP code.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { wipeNonAdminData } from "@/app/actions/admin";

export function DangerZoneCard({ dict }: { dict: Record<string, string> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();

  async function submit() {
    if (pending || token.length !== 6) return;
    setPending(true);
    const res = await wipeNonAdminData(token);
    setPending(false);
    if (res.ok) {
      toast.success(`${dict.wipeDone} (${res.deletedUsers})`);
      setOpen(false);
      setToken("");
      startTransition(() => router.refresh());
    } else if (res.error === "INVALID_TOTP") {
      toast.error(dict.invalidCode);
    } else if (res.error === "RATE_LIMITED") {
      toast.error(dict.rateLimited);
    } else {
      toast.error(dict.wipeDesc);
    }
  }

  return (
    <section className="space-y-3 rounded-[12px] border border-[var(--error-text)]/30 bg-[var(--surface)] p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-destructive" />
        <h2 className="font-[var(--font-serif)] text-lg font-semibold tracking-tight text-foreground">
          {dict.dangerZoneTitle}
        </h2>
      </div>
      <p className="font-[var(--font-sans)] text-sm text-muted-foreground">{dict.wipeDesc}</p>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        {dict.wipeCta}
      </Button>

      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{dict.wipeCta}</DialogTitle>
              <DialogDescription>{dict.wipeDesc}</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                aria-label={dict.wipeCodeLabel}
                className="w-32 rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-center font-mono text-sm tracking-[0.25em] text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
              <span className="font-[var(--font-sans)] text-xs text-muted-foreground">{dict.wipeCodeLabel}</span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                {dict.cancel}
              </Button>
              <Button variant="destructive" onClick={submit} disabled={pending || token.length !== 6}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                {dict.wipeCta}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}

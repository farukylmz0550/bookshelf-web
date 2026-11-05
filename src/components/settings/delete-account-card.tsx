// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteOwnAccount } from "@/app/actions/profile";
import { logoutAction } from "@/app/actions/logout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TotpCodeInput } from "@/components/ui/totp-input";

export function DeleteAccountCard({
  totpEnabled,
  dict,
}: {
  totpEnabled: boolean;
  dict: Record<string, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function close() {
    if (pending) return;
    setOpen(false);
    setPassword("");
    setTotp("");
    setError("");
  }

  function submit() {
    if (!password || (totpEnabled && totp.length !== 6)) return;
    startTransition(async () => {
      const result = await deleteOwnAccount({ password, totp });
      if (!result.ok) {
        const messages: Record<string, string> = {
          INVALID_PASSWORD: dict.invalidPassword,
          INVALID_TOTP: dict.invalidTotp,
          RATE_LIMITED: dict.rateLimited,
          ADMIN_CANNOT_DELETE: dict.adminCannotDelete,
        };
        setError(messages[result.error] ?? dict.deleteFailed);
        setTotp("");
        return;
      }
      await logoutAction();
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <>
      <section className="rounded-[12px] border border-destructive/35 bg-[var(--surface)] p-4">
        <p className="font-[var(--font-sans)] text-sm font-medium text-destructive">{dict.title}</p>
        <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{dict.desc}</p>
        <Button variant="outline" className="mt-3 border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setOpen(true)}>
          <Trash2 size={14} />
          {dict.cta}
        </Button>
      </section>

      <Dialog open={open} onOpenChange={(value) => !value && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dict.confirmTitle}</DialogTitle>
            <DialogDescription>{dict.confirmDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">{dict.passwordLabel}</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {totpEnabled && (
              <div>
                <label className="mb-2 block text-sm font-medium">{dict.totpLabel}</label>
                <TotpCodeInput value={totp} onChange={setTotp} ariaLabel={dict.totpLabel} disabled={pending} />
              </div>
            )}
            {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={close} disabled={pending}>{dict.cancel}</Button>
              <Button variant="destructive" onClick={submit} disabled={pending || !password || (totpEnabled && totp.length !== 6)}>
                {pending ? dict.deleting : dict.confirmCta}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

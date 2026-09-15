// SPDX-License-Identifier: GPL-3.0-only
"use client";

// v2.10.0 — blocking account gates rendered by the dashboard layout:
// 1. mustChangePassword — the user signed in with an admin-assigned temporary
//    password and has to set a new one before the app opens.
// 2. requireTotp — admin accounts must enable TOTP two-factor auth.
// Both render as large (~80% viewport) centered, non-closable dialogs.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { completeForcedPasswordChange } from "@/app/actions/security";
import { TotpSetupFlow, type SecurityDict } from "@/components/settings/security-settings";

export type GateDict = {
  gateChangeTitle: string;
  gateChangeDesc: string;
  gateChangeCta: string;
  gateTotpTitle: string;
  gateTotpDesc: string;
} & SecurityDict;

function ForcedPasswordGate({ dict }: { dict: GateDict }) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();

  async function submit() {
    if (pending || newPassword.length < 8) return;
    setPending(true);
    const res = await completeForcedPasswordChange({ newPassword });
    setPending(false);
    if (res.ok) {
      startTransition(() => router.refresh());
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent showCloseButton={false} className="w-[92vw] max-w-none sm:w-[80vw] sm:max-w-[80vw]">
        <DialogHeader>
          <DialogTitle>{dict.gateChangeTitle}</DialogTitle>
          <DialogDescription>{dict.gateChangeDesc}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
            autoFocus
            className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 font-[var(--font-sans)] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={submit} disabled={pending || newPassword.length < 8}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {dict.gateChangeCta}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TotpGate({ dict }: { dict: GateDict }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent showCloseButton={false} className="w-[92vw] max-w-none sm:w-[80vw] sm:max-w-[80vw]">
        <DialogHeader>
          <DialogTitle>{dict.gateTotpTitle}</DialogTitle>
          <DialogDescription>{dict.gateTotpDesc}</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <TotpSetupFlow dict={dict} onActivated={() => startTransition(() => router.refresh())} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AccountGates({
  mustChangePassword,
  requireTotp,
  dict,
}: {
  mustChangePassword: boolean;
  requireTotp: boolean;
  dict: GateDict;
}) {
  if (mustChangePassword) return <ForcedPasswordGate dict={dict} />;
  if (requireTotp) return <TotpGate dict={dict} />;
  return null;
}

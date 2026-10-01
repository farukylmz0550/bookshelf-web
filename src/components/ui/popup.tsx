// SPDX-License-Identifier: GPL-3.0-only
"use client";

// v3.14.0 — PopupShell: the one popup pattern for the app ("pencerelerin
// işi"). A thin, opinionated wrapper over the shadcn Dialog: consistent max
// height + scroll, safe-area padding and the standard header. Use it instead
// of raw <Dialog> for any new popup so sizing and a11y stay uniform.
//
// APPROVED popup locations (decided with the user, 2026-09-30):
//   • Settings → QR login generation (own popup, 30 s auto-renewing code)
//   • Settings → TOTP entry (own popup; login flow + admin confirmations use
//     the shared TotpCodeInput — never merged with the QR popup)
//   • Lending → create a new borrower in-place (no navigation to /people)
//   • (already-shipped) Add book dialog, next-book picker, share card,
//     admin random-password reveal, danger-zone confirmations, cookie consent
// NOT popups (decided): lending book selection stays a dropdown; profile
// password change stays inline; /pair/<token> (phone side) stays a full page;
// lending history/returns stay inline.

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ReactNode } from "react";

export function PopupShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  width = "sm:max-w-md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  width?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-h-[85dvh] overflow-y-auto ${width}`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

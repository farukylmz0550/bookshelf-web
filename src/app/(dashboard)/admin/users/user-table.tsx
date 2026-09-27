// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { approveUser, rejectUser, toggleAdmin, deleteUser, adminResetPassword } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type User = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  approved: boolean;
  xp: number;
  createdAt: Date;
  _count: { books: number };
};

export function UserTable({
  users,
  dict,
  currentUserId,
  selfTotpEnabled,
}: {
  users: User[];
  dict: Record<string, string>;
  currentUserId: string;
  selfTotpEnabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  // v2.10.0 — admin-assigned random password, shown exactly once.
  const [resetPassword, setResetPassword] = useState<string | null>(null);
  // v3.5.2 — self password reset: TOTP-protected admins confirm with a fresh
  // code; the same random-password dialog follows.
  const [selfResetTotp, setSelfResetTotp] = useState("");
  const [selfResetOpen, setSelfResetOpen] = useState(false);

  function handleApprove(id: string) {
    startTransition(async () => {
      await approveUser(id);
      router.refresh();
    });
  }

  function handleReject(id: string) {
    startTransition(async () => {
      await rejectUser(id);
      router.refresh();
    });
  }

  function handleToggleAdmin(id: string) {
    startTransition(async () => {
      await toggleAdmin(id);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    if (!confirm(dict.confirmDelete)) return;
    startTransition(async () => {
      await deleteUser(id);
      router.refresh();
    });
  }

  async function handleResetPassword(id: string) {
    if (id === currentUserId) {
      if (selfTotpEnabled) {
        setSelfResetTotp("");
        setSelfResetOpen(true);
        return;
      }
      if (!confirm(dict.selfResetConfirm)) return;
    }
    const res = await adminResetPassword(id);
    if (res.ok) {
      setResetPassword(res.password);
      router.refresh();
    } else {
      toast.error(res.error === "INVALID_TOTP" ? dict.selfResetInvalidCode : dict.resetPasswordDesc);
    }
  }

  function confirmSelfReset() {
    if (selfResetTotp.length !== 6) return;
    setSelfResetOpen(false);
    startTransition(async () => {
      const res = await adminResetPassword(currentUserId, selfResetTotp);
      if (res.ok) {
        setResetPassword(res.password);
        router.refresh();
      } else {
        toast.error(res.error === "INVALID_TOTP" ? dict.selfResetInvalidCode : dict.resetPasswordDesc);
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-4 border-b border-border bg-muted/50 px-4 py-2">
        <span className="text-[11px] text-muted-foreground">{dict.name}</span>
        <span className="text-[11px] text-muted-foreground">{dict.email}</span>
        <span className="text-[11px] text-center text-muted-foreground">{dict.adminLabel}</span>
        <span className="text-[11px] text-center text-muted-foreground">{dict.status}</span>
        <span className="text-[11px] text-center text-muted-foreground">{dict.books}</span>
        <span className="text-[11px] text-muted-foreground">{dict.actions}</span>
      </div>
      {users.map((user) => {
        const isSelf = user.id === currentUserId;
        return (
          <div
            key={user.id}
            className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto] items-center gap-4 border-b border-border last:border-b-0 px-4 py-2.5"
          >
            <span className="text-sm font-medium text-foreground truncate">
              {user.name}
              {isSelf && <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">({dict.you})</span>}
            </span>
            <span className="text-sm text-muted-foreground truncate">{user.email}</span>
            <span className="text-center">
              <button
                onClick={() => handleToggleAdmin(user.id)}
                disabled={pending || isSelf}
                title={isSelf ? dict.cannotActOnSelf : undefined}
                className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  user.isAdmin
                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {user.isAdmin ? dict.yes : dict.no}
              </button>
            </span>
            <span className="text-center">
              {user.approved ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {dict.approved}
                </span>
              ) : (
                <span className="rounded-full bg-[var(--warning-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--warning-text)]">
                  {dict.pending}
                </span>
              )}
            </span>
            <span className="text-center text-sm tabular-nums text-muted-foreground">{user._count.books}</span>
            <span className="flex gap-1">
              {!user.approved ? (
                <button
                  onClick={() => handleApprove(user.id)}
                  disabled={pending || isSelf}
                  title={isSelf ? dict.cannotActOnSelf : undefined}
                  className="rounded bg-primary px-2 py-1 text-[10px] text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {dict.approve}
                </button>
              ) : (
                <button
                  onClick={() => handleReject(user.id)}
                  disabled={pending || isSelf}
                  title={isSelf ? dict.cannotActOnSelf : undefined}
                  className="rounded border border-border px-2 py-1 text-[10px] text-muted-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {dict.reject}
                </button>
              )}
              <button
                onClick={() => handleResetPassword(user.id)}
                disabled={pending || (user.isAdmin && !isSelf)}
                title={isSelf ? dict.selfResetTitle : user.isAdmin ? undefined : dict.resetPasswordDesc}
                className="rounded border border-border px-2 py-1 text-[10px] text-muted-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                <KeyRound size={10} className="inline" />
              </button>
              <button
                onClick={() => handleDelete(user.id)}
                disabled={pending || isSelf}
                title={isSelf ? dict.cannotActOnSelf : undefined}
                className="rounded border border-destructive/30 px-2 py-1 text-[10px] text-destructive disabled:cursor-not-allowed disabled:opacity-40"
              >
                {dict.delete}
              </button>
            </span>
          </div>
        );
      })}

      {selfResetOpen && (
        <Dialog open onOpenChange={(open) => !open && setSelfResetOpen(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{dict.selfResetTitle}</DialogTitle>
              <DialogDescription>{dict.selfResetDesc}</DialogDescription>
            </DialogHeader>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              value={selfResetTotp}
              onChange={(e) => setSelfResetTotp(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmSelfReset();
              }}
              placeholder="000000"
              aria-label={dict.selfResetTitle}
              className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-center font-mono text-lg tracking-[0.4em] text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            <div className="flex gap-2">
              <Button onClick={confirmSelfReset} disabled={selfResetTotp.length !== 6 || pending}>
                {dict.resetPasswordCta}
              </Button>
              <Button variant="outline" onClick={() => setSelfResetOpen(false)}>
                {dict.cancel}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {resetPassword && (
        <Dialog open onOpenChange={(open) => !open && setResetPassword(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{dict.resetPasswordTitle}</DialogTitle>
              <DialogDescription>{dict.resetPasswordDone}</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 font-mono text-sm text-foreground">
                {resetPassword}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(resetPassword);
                  toast.success(dict.copiedToast);
                }}
              >
                {dict.copyLabel}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

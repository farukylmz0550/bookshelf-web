// SPDX-License-Identifier: GPL-3.0-only
"use client";

// v3.7.0 — Account card: identity + logout lives in Settings (moved out of
// the sidebar footer and the mobile header per UI_Improvement_Plan.md §6).

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/logout";

export function AccountCard({
  userName,
  userEmail,
  dict,
}: {
  userName: string;
  userEmail: string;
  dict: { title: string; logout: string; logoutConfirm: string; loggingOut: string };
}) {
  const [pending, startTransition] = useTransition();

  function handleLogout() {
    if (!confirm(dict.logoutConfirm)) return;
    startTransition(() => logoutAction());
  }

  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="font-[var(--font-sans)] text-sm font-medium text-foreground">{dict.title}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-[var(--font-sans)] text-sm text-foreground">{userName}</p>
          <p className="truncate font-[var(--font-sans)] text-xs text-muted-foreground">{userEmail}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-[8px] border border-destructive/40 px-3 py-2 font-[var(--font-sans)] text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <LogOut size={14} />
          {pending ? dict.loggingOut : dict.logout}
        </button>
      </div>
    </div>
  );
}

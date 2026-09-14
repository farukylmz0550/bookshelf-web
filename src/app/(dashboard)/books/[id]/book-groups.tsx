// SPDX-License-Identifier: GPL-3.0-only
"use client";

// v2.8.0 — group membership control on the book detail page. Mutations are
// delegated to the centralized actions in @/app/actions/groups.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, FolderPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addBookToGroup, removeBookFromGroup } from "@/app/actions/groups";

type GroupInfo = { id: string; name: string; color: string | null };

type BookGroupsDict = {
  title: string;
  addToGroup: string;
  removeFromGroup: string;
  manageGroups: string;
  addedToast: string;
  removedToast: string;
  errorGeneric: string;
  cancelLabel: string;
};

export function BookGroups({
  bookId,
  memberGroups,
  allGroups,
  dict,
}: {
  bookId: string;
  memberGroups: GroupInfo[];
  allGroups: GroupInfo[];
  dict: BookGroupsDict;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const memberIds = new Set(memberGroups.map((g) => g.id));

  async function toggle(group: GroupInfo) {
    if (busyId) return;
    const isMember = memberIds.has(group.id);
    setBusyId(group.id);
    const res = isMember ? await removeBookFromGroup(bookId, group.id) : await addBookToGroup(bookId, group.id);
    setBusyId(null);
    if (res.ok) {
      toast.success(isMember ? dict.removedToast : dict.addedToast);
      setOpen(false);
      startTransition(() => router.refresh());
    } else {
      toast.error(dict.errorGeneric);
    }
  }

  return (
    <section className="space-y-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="font-medium">{dict.title}</h2>

      <div className="flex flex-wrap items-center gap-2">
        {memberGroups.map((group) => (
          <span
            key={group.id}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] py-1 pr-2 pl-2.5"
          >
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full border border-[var(--border)]"
              style={group.color ? { backgroundColor: group.color } : undefined}
            />
            <span className="min-w-0 truncate font-[var(--font-sans)] text-xs text-foreground">{group.name}</span>
            <button
              type="button"
              aria-label={`${dict.removeFromGroup}: ${group.name}`}
              disabled={pending || busyId === group.id}
              onClick={() => toggle(group)}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50"
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--border)] px-3 py-1 font-[var(--font-sans)] text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50"
        >
          <FolderPlus size={12} />
          {dict.addToGroup}
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dict.addToGroup}</DialogTitle>
            <DialogDescription className="sr-only">{dict.title}</DialogDescription>
          </DialogHeader>
          {allGroups.length === 0 ? (
            <div className="py-4 text-center">
              <Link
                href="/groups"
                className="rounded-[8px] bg-[var(--primary)] px-3 py-1.5 font-[var(--font-sans)] text-sm text-[var(--primary-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
              >
                {dict.manageGroups}
              </Link>
            </div>
          ) : (
            <ul className="max-h-72 space-y-0.5 overflow-y-auto">
              {allGroups.map((group) => {
                const isMember = memberIds.has(group.id);
                return (
                  <li key={group.id}>
                    <button
                      type="button"
                      onClick={() => toggle(group)}
                      disabled={!!busyId}
                      role="checkbox"
                      aria-checked={isMember}
                      className="flex w-full items-center gap-3 rounded-[8px] px-2 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50"
                    >
                      <span
                        aria-hidden="true"
                        className="h-3 w-3 shrink-0 rounded-full border border-[var(--border)]"
                        style={group.color ? { backgroundColor: group.color } : undefined}
                      />
                      <span className="min-w-0 flex-1 truncate font-[var(--font-sans)] text-sm text-foreground">
                        {group.name}
                      </span>
                      {isMember && (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white">
                          <Check size={12} />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {dict.cancelLabel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

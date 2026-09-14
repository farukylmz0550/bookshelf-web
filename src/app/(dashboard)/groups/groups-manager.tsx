// SPDX-License-Identifier: GPL-3.0-only
"use client";

// v2.8.0 — Groups / Shelves management: create, rename, delete, reorder and
// color assignment. Mutations go through the shared server actions in
// @/app/actions/groups — no logic duplicated here.

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDown, ArrowUp, FolderPlus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GROUP_COLORS, GROUP_NAME_MAX } from "@/lib/groups";
import { createGroup, deleteGroup, renameGroup, reorderGroups } from "@/app/actions/groups";

export type GroupRow = {
  id: string;
  name: string;
  color: string | null;
  order: number;
};

export type GroupsDict = {
  title: string;
  create: string;
  createCta: string;
  newGroup: string;
  name: string;
  namePlaceholder: string;
  color: string;
  noColor: string;
  rename: string;
  delete: string;
  deleteConfirm: string;
  reorder: string;
  moveUp: string;
  moveDown: string;
  empty: string;
  emptyHint: string;
  manageGroups: string;
  createdToast: string;
  renamedToast: string;
  deletedToast: string;
  errorDuplicateName: string;
  errorGeneric: string;
  // Supplied by the server page from other dictionary sections.
  booksLabel: string;
  cancelLabel: string;
  saveLabel: string;
};

const HEX_INPUT_RE = /^#[0-9a-fA-F]{6}$/;

function actionError(code: string, dict: GroupsDict): string {
  if (code === "DUPLICATE_NAME") return dict.errorDuplicateName;
  return dict.errorGeneric;
}

type DialogState =
  | null
  | { mode: "create" }
  | { mode: "rename"; group: GroupRow }
  | {
      mode: "delete";
      group: GroupRow;
    };

export function GroupsManager({
  groups,
  counts,
  dict,
}: {
  groups: GroupRow[];
  counts: Record<string, number>;
  dict: GroupsDict;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<GroupRow[]>(groups);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>("");
  const [hexInput, setHexInput] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  const sorted = useMemo(() => [...rows].sort((a, b) => a.order - b.order), [rows]);

  useEffect(() => {
    // Server components re-render this client component in place after
    // mutations; useState would keep the stale mount-time snapshot.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(groups);
  }, [groups]);

  function resetDialog() {
    setDialog(null);
    setName("");
    setColor("");
    setHexInput("");
    setSaving(false);
  }

  function openCreate() {
    setName("");
    setColor("");
    setHexInput("");
    setDialog({ mode: "create" });
  }

  function openRename(group: GroupRow) {
    setName(group.name);
    setColor(group.color ?? "");
    setHexInput("");
    setDialog({ mode: "rename", group });
  }

  async function submitCreateOrRename() {
    if (saving || !dialog || dialog.mode === "delete") return;
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > GROUP_NAME_MAX) return;
    const nextColor = effectiveColor();
    if (nextColor === undefined) return;

    setSaving(true);
    const res =
      dialog.mode === "create"
        ? await createGroup(trimmed, nextColor ?? undefined)
        : await renameGroup(dialog.group.id, trimmed);
    setSaving(false);
    if (res.ok) {
      toast.success(dialog.mode === "create" ? dict.createdToast : dict.renamedToast);
      resetDialog();
      startTransition(() => router.refresh());
    } else {
      toast.error(actionError(res.error, dict));
    }
  }

  async function submitDelete() {
    if (saving || !dialog || dialog.mode !== "delete") return;
    setSaving(true);
    const res = await deleteGroup(dialog.group.id);
    setSaving(false);
    if (res.ok) {
      toast.success(dict.deletedToast);
      resetDialog();
      startTransition(() => router.refresh());
    } else {
      toast.error(actionError(res.error, dict));
    }
  }

  // Effective color: palette pick wins; otherwise a validated hex input.
  // `undefined` marks an invalid hex and blocks submission.
  function effectiveColor(): string | null | undefined {
    if (color) return color;
    if (hexInput.trim()) {
      if (!HEX_INPUT_RE.test(hexInput.trim())) return undefined;
      return hexInput.trim().toLowerCase();
    }
    return null;
  }

  // Up/down reordering: reorder locally, persist the full permutation compactly.
  async function move(group: GroupRow, direction: -1 | 1) {
    const ordered = sorted.map((g) => g.id);
    const index = ordered.indexOf(group.id);
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    setRows(
      ordered.map((id, order) => {
        const row = sorted.find((g) => g.id === id);
        return { id, name: row?.name ?? "", color: row?.color ?? null, order };
      }),
    );
    const res = await reorderGroups(ordered);
    if (res.ok) {
      startTransition(() => router.refresh());
    } else {
      toast.error(actionError(res.error, dict));
    }
  }

  return (
    <div className="space-y-4">
      {sorted.length === 0 ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center py-16">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" className="mb-4 h-16 w-16 opacity-20" />
            <p className="font-[var(--font-sans)] text-sm text-muted-foreground">{dict.empty}</p>
            <p className="font-[var(--font-sans)] text-xs text-muted-foreground">{dict.emptyHint}</p>
          </div>
          <div className="flex justify-center">
            <Button onClick={openCreate}>
              <FolderPlus size={16} />
              {dict.create}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="font-[var(--font-sans)] text-xs text-muted-foreground">{dict.manageGroups}</p>
            <Button size="sm" onClick={openCreate}>
              <FolderPlus size={14} />
              {dict.create}
            </Button>
          </div>
          <div className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface)]">
            {sorted.map((group, index) => (
              <div
                key={group.id}
                className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2.5 last:border-b-0"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-full border border-[var(--border)]"
                    style={group.color ? { backgroundColor: group.color } : undefined}
                  />
                  <Link
                    href={`/groups/${group.id}`}
                    className="min-w-0 flex-1 truncate font-[var(--font-serif)] text-sm text-foreground transition-colors hover:text-[var(--accent)]"
                  >
                    {group.name}
                  </Link>
                  <span className="shrink-0 font-[var(--font-sans)] text-xs text-muted-foreground">
                    {counts[group.id] ?? 0} {dict.booksLabel}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    aria-label={`${dict.moveUp}: ${group.name}`}
                    disabled={index === 0}
                    onClick={() => move(group, -1)}
                    className="flex h-7 w-7 items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-30"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label={`${dict.moveDown}: ${group.name}`}
                    disabled={index === sorted.length - 1}
                    onClick={() => move(group, 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-30"
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label={`${dict.rename}: ${group.name}`}
                    onClick={() => openRename(group)}
                    className="flex h-7 w-7 items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label={`${dict.delete}: ${group.name}`}
                    onClick={() => setDialog({ mode: "delete", group })}
                    className="flex h-7 w-7 items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-accent hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {dialog?.mode === "delete" && (
        <Dialog open onOpenChange={(open) => !open && resetDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{dict.delete}</DialogTitle>
              <DialogDescription>{dict.deleteConfirm}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={resetDialog}>
                {dict.cancelLabel}
              </Button>
              <Button variant="destructive" onClick={submitDelete} disabled={saving}>
                {dict.delete}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {(dialog?.mode === "create" || dialog?.mode === "rename") && (
        <Dialog open onOpenChange={(open) => !open && resetDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{dialog.mode === "rename" ? dict.rename : dict.newGroup}</DialogTitle>
              <DialogDescription className="sr-only">
                {dialog.mode === "rename" ? dict.rename : dict.create}
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitCreateOrRename();
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="group-name">{dict.name}</Label>
                <Input
                  id="group-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={dict.namePlaceholder}
                  maxLength={GROUP_NAME_MAX}
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>{dict.color}</Label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    aria-label={dict.noColor}
                    aria-pressed={!color && !hexInput.trim()}
                    onClick={() => {
                      setColor("");
                      setHexInput("");
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] bg-transparent text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] data-pressed:ring-2 data-pressed:ring-[var(--ring)]"
                  >
                    <MoreHorizontal size={12} />
                  </button>
                  {GROUP_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`${dict.color} ${c}`}
                      aria-pressed={color === c}
                      onClick={() => {
                        setColor(c);
                        setHexInput("");
                      }}
                      className="h-6 w-6 rounded-full border border-[var(--border)] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] data-pressed:scale-110 data-pressed:ring-2 data-pressed:ring-[var(--ring)] data-pressed:ring-offset-1"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span
                    aria-hidden="true"
                    className="h-5 w-5 shrink-0 rounded-full border border-[var(--border)]"
                    style={
                      color || (HEX_INPUT_RE.test(hexInput.trim()) ? hexInput.trim().toLowerCase() : undefined)
                        ? { backgroundColor: color || hexInput.trim().toLowerCase() }
                        : undefined
                    }
                  />
                  <input
                    type="text"
                    value={hexInput}
                    onChange={(e) => {
                      setHexInput(e.target.value);
                      setColor("");
                    }}
                    placeholder="#b56f76"
                    aria-label={dict.color}
                    className="w-28 rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 font-[var(--font-mono)] text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetDialog}>
                  {dict.cancelLabel}
                </Button>
                <Button type="submit" disabled={!canSubmit() || saving}>
                  {dialog.mode === "rename" ? dict.saveLabel : dict.createCta}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );

  function canSubmit(): boolean {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > GROUP_NAME_MAX) return false;
    if (hexInput.trim() && !HEX_INPUT_RE.test(hexInput.trim())) return false;
    return true;
  }
}

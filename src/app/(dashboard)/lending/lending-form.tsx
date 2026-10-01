// SPDX-License-Identifier: GPL-3.0-only
"use client";

// v3.14.0 — borrowers are still selected from a dropdown, but a NEW borrower
// is now created in-place through a popup (PopupShell) instead of navigating
// to /people. This intentionally relaxes UI Design Language §2 "One Place,
// One Purpose" for person creation (user decision, 2026-09-30): /people stays
// as the management page (rename? remove), while the lending flow gets a
// no-context-loss quick-create. The popup closes into the dropdown with the
// fresh person pre-selected.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createLending } from "@/app/actions/lending";
import { createPerson } from "@/app/actions/people";
import { PopupShell } from "@/components/ui/popup";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Book = { id: string; title: string };
type Person = { id: string; name: string };

export function LendingForm({
  books,
  people,
  dict,
}: {
  books: Book[];
  people: Person[];
  dict: {
    book: string;
    borrower: string;
    lendCta: string;
    namePlaceholder: string;
    dueDate: string;
    dueDateOptional: string;
    noPeople: string;
    addPeople: string;
    newPerson: string;
    save: string;
    personAdded: string;
  };
}) {
  const router = useRouter();
  const [bookId, setBookId] = useState(books[0]?.id ?? "");
  // Locally-known people = server-provided + ones created in this session
  // (so the popup's fresh person is selectable without waiting for a refresh).
  const [knownPeople, setKnownPeople] = useState<Person[]>(people);
  const [personId, setPersonId] = useState(people[0]?.id ?? "");
  // v3.7.0 — Base UI resolves SelectValue labels only while items are
  // mounted; after a refresh the closed trigger falls back to the raw value
  // (a cuid). Pass the resolved label explicitly.
  const selectedBook = books.find((b) => b.id === bookId);
  const selectedPerson = knownPeople.find((p) => p.id === personId);
  const [dueDate, setDueDate] = useState("");
  const [pending, startTransition] = useTransition();

  // v3.14.0 — in-place borrower creation
  const [popupOpen, setPopupOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPersonError, setNewPersonError] = useState<string | null>(null);
  const [creating, startCreating] = useTransition();

  const today = new Date();
  const minDue = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) + 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10);

  function handleSubmit() {
    if (!bookId || !personId) return;
    const due = dueDate || null;
    if (due) {
      const normalized = new Date(due);
      if (isNaN(normalized.getTime())) return; // client-side UX guard; server is authoritative
    }
    startTransition(async () => {
      await createLending(bookId, personId, due);
      setDueDate("");
    });
  }

  function handleCreatePerson() {
    setNewPersonError(null);
    startCreating(async () => {
      const res = await createPerson(newName);
      if ("error" in res) {
        setNewPersonError(res.error);
        return;
      }
      // Fresh person lands in the dropdown pre-selected; server list catches
      // up via revalidatePath + router.refresh.
      setKnownPeople((prev) => [...prev, res.person]);
      setPersonId(res.person.id);
      setNewName("");
      setPopupOpen(false);
      toast.success(dict.personAdded);
      router.refresh();
    });
  }

  const inputCls =
    "w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 font-[var(--font-sans)] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[200px]">
        <label className="mb-1 block font-[var(--font-sans)] text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          {dict.book}
        </label>
        <Select value={bookId} onValueChange={(v) => setBookId(v ?? "")}>
          <SelectTrigger
            className="w-full rounded-[8px] border-[var(--border)] bg-[var(--surface-elevated)] text-foreground focus-visible:ring-[var(--ring)]"
            aria-label={dict.book}
          >
            <SelectValue>{selectedBook?.title ?? ""}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {books.map((book) => (
              <SelectItem key={book.id} value={book.id}>
                {book.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-[160px]">
        <label className="mb-1 block font-[var(--font-sans)] text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          {dict.borrower}
        </label>
        {knownPeople.length === 0 ? (
          <div className="space-y-1" role="status">
            <p className="font-[var(--font-sans)] text-sm text-muted-foreground">{dict.noPeople}</p>
            <Button
              variant="outline"
              onClick={() => setPopupOpen(true)}
              className="gap-1.5 rounded-[8px] px-3 py-1.5 text-xs"
            >
              <UserPlus size={14} />
              {dict.newPerson}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Select value={personId} onValueChange={(v) => setPersonId(v ?? "")}>
              <SelectTrigger
                className="w-full rounded-[8px] border-[var(--border)] bg-[var(--surface-elevated)] text-foreground focus-visible:ring-[var(--ring)]"
                aria-label={dict.borrower}
              >
                <SelectValue>{selectedPerson?.name ?? ""}</SelectValue>
              </SelectTrigger>
              <SelectContent aria-label={dict.namePlaceholder}>
                {knownPeople.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPopupOpen(true)}
              aria-label={dict.newPerson}
              title={dict.newPerson}
              className="h-9 w-9 shrink-0 rounded-[8px]"
            >
              <UserPlus size={15} />
            </Button>
          </div>
        )}
      </div>
      <div className="min-w-[150px]">
        <label className="mb-1 block font-[var(--font-sans)] text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          {dict.dueDate} <span className="normal-case tracking-normal opacity-60">({dict.dueDateOptional})</span>
        </label>
        <input
          type="date"
          value={dueDate}
          min={minDue}
          onChange={(e) => setDueDate(e.target.value)}
          className={inputCls}
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={pending || !bookId || !personId}
        className="rounded-[8px] bg-[var(--accent)] px-5 py-2 font-[var(--font-sans)] text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {dict.lendCta}
      </button>

      <PopupShell
        open={popupOpen}
        onOpenChange={(next) => {
          setPopupOpen(next);
          if (!next) {
            setNewName("");
            setNewPersonError(null);
          }
        }}
        title={dict.newPerson}
      >
        <div className="space-y-3">
          <input
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setNewPersonError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim() && !creating) handleCreatePerson();
            }}
            placeholder={dict.namePlaceholder}
            autoFocus
            maxLength={200}
            className={inputCls}
          />
          {newPersonError && (
            <p className="font-[var(--font-sans)] text-xs text-[var(--error-text)]" role="alert">
              {newPersonError}
            </p>
          )}
          <div className="flex justify-end">
            <Button onClick={handleCreatePerson} disabled={creating || !newName.trim()}>
              {dict.save}
            </Button>
          </div>
        </div>
      </PopupShell>
    </div>
  );
}

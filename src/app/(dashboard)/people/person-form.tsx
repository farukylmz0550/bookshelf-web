// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, UserMinus } from "lucide-react";
import { createPerson, removePerson } from "@/app/actions/people";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PersonForm({
  placeholder,
  addLabel,
  removeLabel,
  selectedId,
}: {
  placeholder: string;
  addLabel: string;
  removeLabel: string;
  selectedId?: string;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createPerson(name);
      if ("error" in res) setError(res.error);
      else {
        setName("");
        router.refresh();
      }
    });
  }

  function onRemove() {
    if (!selectedId) return;
    setError(null);
    startTransition(async () => {
      const res = await removePerson(selectedId);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <form onSubmit={onAdd} className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-[8px] border-[var(--border)] bg-[var(--surface-elevated)] font-[var(--font-sans)] focus-visible:ring-[var(--ring)]"
        />
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          className="rounded-[8px] bg-[var(--accent)] font-[var(--font-sans)] text-white hover:bg-[var(--accent-hover)]"
        >
          <UserPlus size={14} />
          {addLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRemove}
          disabled={pending || !selectedId}
          className="rounded-[8px] border-[var(--border)] font-[var(--font-sans)]"
        >
          <UserMinus size={14} />
          {removeLabel}
        </Button>
      </form>
      {error && (
        <div className="flex items-center gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--error-soft)] px-3 py-2 text-sm text-[var(--error-text)]">
          <span className="font-[var(--font-sans)]">{error}</span>
        </div>
      )}
    </div>
  );
}

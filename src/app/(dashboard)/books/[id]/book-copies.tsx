// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState, useTransition } from "react";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { assignBookCopyLocation } from "@/app/actions/copies";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Copy = {
  id: string;
  copyNumber: number;
  barcode: string | null;
  locationId: string | null;
  archivedAt: Date | string | null;
};
type Location = { id: string; name: string; archivedAt: Date | string | null };
export type BookCopiesDict = {
  copiesTitle: string;
  copy: string;
  unassigned: string;
  saved: string;
  error: string;
  archived: string;
};

export function BookCopies({
  bookId,
  copies,
  locations,
  dict,
}: {
  bookId: string;
  copies: Copy[];
  locations: Location[];
  dict: BookCopiesDict;
}) {
  const [rows, setRows] = useState(copies);
  const [saving, startTransition] = useTransition();
  const activeLocations = locations.filter((location) => !location.archivedAt);

  async function change(copyId: string, locationId: string) {
    const result = await assignBookCopyLocation(bookId, copyId, locationId === "none" ? null : locationId);
    if (!result.ok) return toast.error(dict.error);
    setRows((current) =>
      current.map((copy) =>
        copy.id === copyId ? { ...copy, locationId: locationId === "none" ? null : locationId } : copy,
      ),
    );
    startTransition(() => undefined);
    toast.success(dict.saved);
  }

  return (
    <section className="space-y-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center gap-2">
        <MapPin size={17} className="text-muted-foreground" />
        <h2 className="font-medium">{dict.copiesTitle}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{dict.copy}: 0</p>
      ) : (
        <div className="space-y-2">
          {rows.map((copy) => {
            const current = copy.locationId ?? "none";
            return (
              <div
                key={copy.id}
                className="flex flex-wrap items-center gap-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2"
              >
                <span className="min-w-16 text-sm text-foreground">
                  {dict.copy} {copy.copyNumber}
                </span>
                {copy.barcode && <code className="text-xs text-muted-foreground">{copy.barcode}</code>}
                {copy.archivedAt && <span className="text-xs text-muted-foreground">{dict.archived}</span>}
                {!copy.archivedAt && (
                  <Select value={current} onValueChange={(value) => value && change(copy.id, value)} disabled={saving}>
                    <SelectTrigger
                      className="ms-auto min-w-40 rounded-[8px] border-[var(--border)] bg-[var(--surface)] text-foreground"
                      aria-label={`${dict.copy} ${copy.copyNumber}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{dict.unassigned}</SelectItem>
                      {activeLocations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

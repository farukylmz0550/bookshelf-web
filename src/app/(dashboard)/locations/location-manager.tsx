// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, MapPinned, Plus } from "lucide-react";
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
import { createLocation, updateLocation } from "@/app/actions/locations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type LocationRow = {
  id: string;
  name: string;
  kind: string;
  parentId: string | null;
  archivedAt: Date | null;
  _count: { copies: number };
};
export type LocationsDict = {
  create: string;
  newTitle: string;
  name: string;
  namePlaceholder: string;
  kind: string;
  save: string;
  cancel: string;
  archive: string;
  empty: string;
  copies: string;
  error: string;
  parent: string;
  noParent: string;
  kinds: Record<string, string>;
};

export function LocationManager({ locations, dict }: { locations: LocationRow[]; dict: LocationsDict }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("SHELF");
  const [parentId, setParentId] = useState("none");
  const [saving, startTransition] = useTransition();

  async function submit() {
    const result = await createLocation(name, kind, parentId === "none" ? null : parentId);
    if (!result.ok) return toast.error(dict.error);
    setOpen(false);
    setName("");
    setParentId("none");
    toast.success(dict.save);
    startTransition(() => router.refresh());
  }

  async function archive(id: string) {
    const result = await updateLocation(id, { archived: true });
    if (!result.ok) return toast.error(dict.error);
    toast.success(dict.save);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={14} />
          {dict.create}
        </Button>
      </div>
      {locations.length === 0 ? (
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-muted-foreground">
          {dict.empty}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface)]">
          {locations.map((location) => (
            <div
              key={location.id}
              className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 last:border-b-0"
            >
              <MapPinned size={18} className="shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{location.name}</p>
                <p className="text-xs text-muted-foreground">
                  {dict.kinds[location.kind] ?? location.kind} · {location._count.copies} {dict.copies}
                </p>
              </div>
              {!location.archivedAt && (
                <button
                  type="button"
                  onClick={() => archive(location.id)}
                  disabled={saving}
                  aria-label={`${dict.archive}: ${location.name}`}
                  className="flex h-8 w-8 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Archive size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dict.newTitle}</DialogTitle>
            <DialogDescription className="sr-only">{dict.newTitle}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="location-name">{dict.name}</Label>
              <Input
                id="location-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={dict.namePlaceholder}
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{dict.kind}</Label>
              <Select value={kind} onValueChange={(value) => value && setKind(value)}>
                <SelectTrigger className="w-full bg-background text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ROOM">{dict.kinds.ROOM}</SelectItem>
                  <SelectItem value="SECTION">{dict.kinds.SECTION}</SelectItem>
                  <SelectItem value="SHELF">{dict.kinds.SHELF}</SelectItem>
                  <SelectItem value="BOX">{dict.kinds.BOX}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{dict.parent}</Label>
              <Select value={parentId} onValueChange={(value) => value && setParentId(value)}>
                <SelectTrigger className="w-full bg-background text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{dict.noParent}</SelectItem>
                  {locations
                    .filter((location) => !location.archivedAt)
                    .map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {dict.cancel}
            </Button>
            <Button onClick={submit} disabled={saving || !name.trim()}>
              {dict.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

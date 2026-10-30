// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createSmartCollection, previewSmartCollection } from "@/app/actions/groups";

const fields = ["status", "rating", "tag", "series", "author", "language", "publishYear", "pages"] as const;
const operators = ["equals", "contains", "gte", "lte"] as const;
type Field = (typeof fields)[number];
export type SmartCollectionDict = {
  create: string;
  title: string;
  name: string;
  namePlaceholder: string;
  field: string;
  operator: string;
  value: string;
  preview: string;
  matches: string;
  save: string;
  cancel: string;
  error: string;
  fields: Record<string, string>;
  operators: Record<string, string>;
};

export function SmartCollectionForm({ dict }: { dict: SmartCollectionDict }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [field, setField] = useState<Field>("status");
  const [operator, setOperator] = useState<(typeof operators)[number]>("equals");
  const [value, setValue] = useState("READING");
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function rule() {
    const numeric = ["rating", "publishYear", "pages"].includes(field);
    return { version: 1 as const, all: [{ field, operator, value: numeric ? Number(value) : value }], any: [] };
  }

  function reset() {
    setOpen(false);
    setName("");
    setField("status");
    setOperator("equals");
    setValue("READING");
    setMatchCount(null);
  }

  function preview() {
    startTransition(() => {
      void (async () => {
        const result = await previewSmartCollection(rule());
        if (!result.ok) return toast.error(dict.error);
        setMatchCount(result.total);
      })();
    });
  }

  function save() {
    startTransition(() => {
      void (async () => {
        const result = await createSmartCollection(name, rule());
        if (!result.ok) return toast.error(dict.error);
        toast.success(dict.save);
        reset();
      })();
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Sparkles size={14} />
        {dict.create}
      </Button>
      <Dialog open={open} onOpenChange={(next) => !next && reset()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dict.title}</DialogTitle>
            <DialogDescription className="sr-only">{dict.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="smart-name">{dict.name}</Label>
              <Input
                id="smart-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={dict.namePlaceholder}
                maxLength={60}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{dict.field}</Label>
                <Select value={field} onValueChange={(next) => next && setField(next as Field)}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{dict.fields[field]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((item) => (
                      <SelectItem key={item} value={item}>
                        {dict.fields[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{dict.operator}</Label>
                <Select
                  value={operator}
                  onValueChange={(next) => next && setOperator(next as (typeof operators)[number])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>{dict.operators[operator]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {operators.map((item) => (
                      <SelectItem key={item} value={item}>
                        {dict.operators[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smart-value">{dict.value}</Label>
              <Input
                id="smart-value"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                inputMode={["rating", "publishYear", "pages"].includes(field) ? "numeric" : "text"}
              />
            </div>
            {matchCount !== null && (
              <p className="rounded-[8px] bg-[var(--info-soft)] px-3 py-2 text-sm text-[var(--info-text)]">
                {matchCount} {dict.matches}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={reset}>
              {dict.cancel}
            </Button>
            <Button variant="secondary" onClick={preview} disabled={pending || !value.trim()}>
              {dict.preview}
            </Button>
            <Button onClick={save} disabled={pending || !name.trim() || !value.trim()}>
              {dict.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

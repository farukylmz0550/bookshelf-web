// SPDX-License-Identifier: GPL-3.0-only
"use client";

// v3.8.0 — Faz 2 (UI_Improvement_Plan.md §2): the add-book workflow moves out
// of the collection flow behind a primary "+ Add book" action. The dialog
// hosts the full panel (quick ISBN/title/author, detailed add, Excel/CSV
// import-export) — hierarchy change, not feature removal.

import { useState } from "react";
import { BookPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BooksAddSection } from "./books-add-section";

export function AddBookDialog({
  dict,
  excel,
  label,
  addedToastLabel,
}: {
  dict: Record<string, unknown> & {
    addSuccess?: string;
    bookTitle?: string;
    add?: string;
    detailedAdd?: string;
    orWithAllFields?: string;
  };
  excel: React.ReactNode;
  label: string;
  addedToastLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <BookPlus size={14} />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>{addedToastLabel}</DialogDescription>
          </DialogHeader>
          <BooksAddSection dict={dict as never} excel={excel} onAdded={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState, useTransition } from "react";
import { BookOpen, FileDown, FileUp, FileSpreadsheet } from "lucide-react";
import { exportLibraryExcel, buildTemplateExcel, importExcelFile } from "@/app/actions/excel";
import { importBooksCsv } from "@/app/actions/goodreads";
import { Button } from "@/components/ui/button";

function downloadBase64(base64: string, filename: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Revoke later — revoking synchronously can cancel an in-progress download
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function ExcelActions({
  dict,
  goodreadsDict,
}: {
  dict: Record<string, string>;
  goodreadsDict: Record<string, string>;
}) {
  const [pending, startTransition] = useTransition();
  const [grPending, startGr] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [grMsg, setGrMsg] = useState<string | null>(null);

  function onExport() {
    startTransition(async () => {
      const { base64, filename } = await exportLibraryExcel();
      downloadBase64(base64, filename);
    });
  }
  function onTemplate() {
    startTransition(async () => {
      const { base64, filename } = await buildTemplateExcel();
      downloadBase64(base64, filename);
    });
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setMsg(dict.fileTooLarge);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      startTransition(async () => {
        const res = await importExcelFile(base64);
        setMsg(res.error ?? `${dict.imported} ${res.imported} books`);
      });
    };
    reader.readAsDataURL(file);
  }

  function onGoodreadsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setGrMsg(goodreadsDict.fileTooLarge);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      startGr(async () => {
        // v3.3.0 — unified CSV import: Goodreads / Calibre / StoryGraph
        const res = await importBooksCsv(base64);
        if (res.error) {
          const msg =
            res.error === "invalidCsv"
              ? goodreadsDict.invalidCsv
              : res.error === "fileTooLarge"
                ? goodreadsDict.fileTooLarge
                : res.error === "tooManyRows"
                  ? goodreadsDict.tooManyRows
                  : res.error === "noValidBooks"
                    ? goodreadsDict.noValidBooks
                    : res.error;
          setGrMsg(res.errors.length > 0 ? `${msg} — ${res.errors[0]}` : msg);
          return;
        }
        setGrMsg(
          `${goodreadsDict.importComplete}: ${goodreadsDict.imported} ${res.imported} · ${goodreadsDict.duplicatesSkipped} ${res.duplicates} · ${goodreadsDict.invalidRows} ${res.invalid}` +
            (res.lookupFailed > 0 ? ` · ${goodreadsDict.lookupFailed} ${res.lookupFailed}` : ""),
        );
      });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={onTemplate} disabled={pending}>
        <FileSpreadsheet size={14} />
        {dict.template}
      </Button>
      <Button variant="outline" size="sm" onClick={onExport} disabled={pending}>
        <FileDown size={14} />
        {dict.export}
      </Button>
      <label className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer">
        <FileUp size={14} />
        {dict.importExcel}
        <input type="file" accept=".xlsx,.xls" onChange={onFile} className="hidden" />
      </label>
      <label className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer">
        <BookOpen size={14} />
        {grPending ? goodreadsDict.importing : goodreadsDict.importCsv}
        <input type="file" accept=".csv,text/csv" onChange={onGoodreadsFile} className="hidden" />
      </label>
      {grMsg && <span className="text-sm text-muted-foreground">{grMsg}</span>}
      {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
    </div>
  );
}

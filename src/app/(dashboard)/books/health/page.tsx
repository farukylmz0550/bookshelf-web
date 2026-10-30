// SPDX-License-Identifier: GPL-3.0-only
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, RefreshCw, ShieldAlert } from "lucide-react";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireUserId } from "@/lib/session";
import { getBooksHealthReport } from "@/lib/services/health";

const severityStyles = {
  critical: { icon: ShieldAlert, className: "border-[var(--error)]/30 bg-[var(--error-soft)]" },
  warning: { icon: AlertTriangle, className: "border-[var(--warning)]/30 bg-[var(--warning-soft)]" },
  info: { icon: Info, className: "border-[var(--info)]/30 bg-[var(--info-soft)]" },
} as const;

export default async function BooksHealthPage() {
  const userId = await requireUserId();
  const dict = await getDictionary();
  const report = await getBooksHealthReport(userId, { limit: 500 });
  const t = dict.health;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Link href="/books" className="text-sm text-muted-foreground hover:text-foreground">
            {dict.books.back}
          </Link>
          <h1 className="font-[var(--font-serif)] text-2xl font-semibold tracking-tight text-foreground">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.description}</p>
        </div>
        <form action="/books/health" className="pt-6">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-foreground hover:bg-[var(--surface-elevated)]"
          >
            <RefreshCw size={16} /> {t.refresh}
          </button>
        </form>
      </header>

      <section aria-label={t.summary} className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          [t.critical, report.summary.critical, "text-[var(--error-text)]"],
          [t.warnings, report.summary.warning, "text-[var(--warning-text)]"],
          [t.missingMetadata, report.summary.missingMetadata, "text-[var(--info-text)]"],
          [t.duplicates, report.summary.duplicateCandidates, "text-foreground"],
        ].map(([label, count, color]) => (
          <div key={label} className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`mt-1 text-2xl font-semibold ${color}`}>{count}</p>
          </div>
        ))}
      </section>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 size={14} /> {t.generatedAt}: {new Date(report.generatedAt).toLocaleString()}
      </div>

      {report.findings.length === 0 ? (
        <div className="rounded-[12px] border border-[var(--success)]/30 bg-[var(--success-soft)] p-6 text-center text-sm text-[var(--success-text)]">
          {t.noFindings}
        </div>
      ) : (
        <section className="space-y-3" aria-label={t.findings}>
          {report.findings.map((finding) => {
            const style = severityStyles[finding.severity];
            const Icon = style.icon;
            return (
              <article
                key={`${finding.findingCode}-${finding.bookId}`}
                className={`flex gap-3 rounded-[12px] border p-4 ${style.className}`}
              >
                <Icon size={18} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link href={`/books/${finding.bookId}`} className="font-medium text-foreground hover:underline">
                      {finding.bookTitle}
                    </Link>
                    <code className="text-[11px] text-muted-foreground">{finding.findingCode}</code>
                  </div>
                  <p className="text-sm text-foreground/80">{finding.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.suggestedAction}: {t.actions[finding.suggestedAction]}
                  </p>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

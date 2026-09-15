// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Volume2, VolumeX } from "lucide-react";
import type { AnnualReadingSummary } from "@/lib/stats";
import { shareCardData } from "@/lib/share-card";
import { pieceForYear } from "@/lib/annual-music";
import { drawShareCard, exportShareCard } from "./share-image";
import { MonthlyChart } from "./monthly-chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type AnnualSummaryDict = {
  title: string;
  selectYear: string;
  readingSummary: string;
  booksRead: string;
  pagesRead: string;
  averagePages: string;
  readingDays: string;
  longestStreak: string;
  mostReadAuthor: string;
  mostReadGenre: string;
  uniqueAuthors: string;
  uniqueGenres: string;
  firstBook: string;
  lastBook: string;
  longestBook: string;
  shortestBook: string;
  byMonth: string;
  notableBooks: string;
  exportSummary: string;
  exporting: string;
  noReadingData: string;
  noData: string;
  insightBooksOne: string;
  insightBooksMany: string;
  insightPagesOne: string;
  insightPagesMany: string;
  insightStreakOne: string;
  insightStreakMany: string;
  insightMonth: string;
  insightGenre: string;
  insightAuthor: string;
  shareCardTitle: string;
  pagesShort: string;
  enableSound: string;
  soundOn: string;
  soundOff: string;
};

function fmt(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}

/** Deterministic, data-driven recap lines — only metrics that exist. */
function buildInsights(summary: AnnualReadingSummary, monthLabels: string[], d: AnnualSummaryDict): string[] {
  const lines: string[] = [
    fmt(summary.booksRead === 1 ? d.insightBooksOne : d.insightBooksMany, { count: summary.booksRead }),
  ];
  if (summary.pagesRead !== null) {
    lines.push(fmt(summary.pagesRead === 1 ? d.insightPagesOne : d.insightPagesMany, { count: summary.pagesRead }));
  }
  if (summary.longestStreak > 0) {
    lines.push(
      fmt(summary.longestStreak === 1 ? d.insightStreakOne : d.insightStreakMany, { count: summary.longestStreak }),
    );
  }
  const maxCount = Math.max(...summary.monthlyBooks);
  if (maxCount > 0) lines.push(fmt(d.insightMonth, { month: monthLabels[summary.monthlyBooks.indexOf(maxCount)] }));
  if (summary.topGenre) lines.push(fmt(d.insightGenre, { genre: summary.topGenre }));
  if (summary.topAuthor) lines.push(fmt(d.insightAuthor, { author: summary.topAuthor }));
  return lines;
}

export function AnnualSummary({
  summary,
  availableYears,
  selectedYear,
  monthLabels,
  dark,
  dict,
  yearlyTarget,
}: {
  summary: AnnualReadingSummary;
  availableYears: number[];
  selectedYear: number;
  monthLabels: string[];
  dark: boolean;
  dict: AnnualSummaryDict;
  yearlyTarget: number;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [exporting, setExporting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const isEmpty = summary.booksRead === 0;

  // Predetermined piece — the app (not the user) selects it from the year and
  // the yearly-goal progress mood. Plays once; never loops.
  const piece = useMemo(
    () => pieceForYear(summary.year, summary.booksRead, yearlyTarget),
    [summary.year, summary.booksRead, yearlyTarget],
  );

  // Respect browser autoplay policies: try to play, fall back to a single
  // "Enable sound" action if audible autoplay is blocked. Plays once, no loop.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || isEmpty) return;
    setNeedsGesture(false);
    audio.currentTime = 0;
    audio.play().catch(() => setNeedsGesture(true));
  }, [piece.src, isEmpty]);

  function enableSound() {
    const audio = audioRef.current;
    if (!audio) return;
    setMuted(false);
    audio.muted = false;
    void audio.play();
    setNeedsGesture(false);
  }

  function toggleMute() {
    const audio = audioRef.current;
    setMuted((m) => {
      const next = !m;
      if (audio) audio.muted = next;
      if (!next) void audio?.play().catch(() => {});
      return next;
    });
  }

  const insights = useMemo(
    () => (isEmpty ? [] : buildInsights(summary, monthLabels, dict)),
    [isEmpty, summary, monthLabels, dict],
  );

  const chartData = summary.monthlyBooks.map((count, i) => ({ month: monthLabels[i], count }));

  async function onExport() {
    setExporting(true);
    try {
      const card = shareCardData(summary, {
        brand: "Book Shelf",
        cardTitle: dict.shareCardTitle,
        booksRead: dict.booksRead,
        pagesRead: dict.pagesRead,
        longestStreak: dict.longestStreak,
        mostReadAuthor: dict.mostReadAuthor,
        mostReadGenre: dict.mostReadGenre,
      });
      const canvas = canvasRef.current;
      if (!canvas) return;
      drawShareCard(canvas, card, dark);
      await exportShareCard(canvas, `bookshelf-${summary.year}.png`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <section
      className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6"
      aria-labelledby="annual-summary-heading"
    >
      {/* Predetermined background music — plays once; user cannot pick the piece */}
      <audio
        ref={audioRef}
        src={piece.src}
        muted={muted}
        loop={false}
        preload="none"
        onEnded={() => setNeedsGesture(false)}
        className="hidden"
        aria-hidden="true"
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2
          id="annual-summary-heading"
          className="font-[var(--font-serif)] text-xl font-semibold tracking-tight text-foreground"
        >
          {dict.title}
        </h2>
        <div className="flex items-center gap-2">
          {needsGesture && (
            <button
              type="button"
              onClick={enableSound}
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-border bg-[var(--surface-elevated)] px-3 py-1.5 font-[var(--font-sans)] text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Volume2 size={14} />
              {dict.enableSound}
            </button>
          )}
          {!isEmpty && (
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? dict.soundOn : dict.soundOff}
              aria-pressed={muted}
              className="inline-flex items-center rounded-[8px] border border-border bg-[var(--surface-elevated)] p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span id="annual-year-label">{dict.selectYear}</span>
            <Select
              value={String(selectedYear)}
              onValueChange={(v) => router.push(`/stats?year=${v}`, { scroll: false })}
            >
              <SelectTrigger
                className="rounded-[8px] border-[var(--border)] bg-[var(--surface-elevated)] text-foreground focus-visible:ring-[var(--ring)]"
                aria-labelledby="annual-year-label"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isEmpty ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {fmt(dict.noReadingData, { year: selectedYear })}
        </p>
      ) : (
        <div className="space-y-4">
          {/* Intro / hero */}
          <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-elevated)] p-5 sm:p-8">
            <p className="font-[var(--font-serif)] text-[11px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
              {dict.readingSummary}
            </p>
            <p className="mt-1 font-[var(--font-serif)] text-5xl font-bold tabular-nums text-[var(--accent)] sm:text-6xl">
              {summary.year}
            </p>
            <ul className="mt-4 space-y-1.5" aria-label={dict.readingSummary}>
              {insights.map((line) => (
                <li key={line} className="font-[var(--font-serif)] text-[15px] text-foreground">
                  {line}
                </li>
              ))}
            </ul>
          </div>

          {/* Core numbers */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: dict.booksRead, value: String(summary.booksRead) },
              { label: dict.pagesRead, value: summary.pagesRead === null ? "—" : String(summary.pagesRead) },
              { label: dict.averagePages, value: summary.averagePages === null ? "—" : String(summary.averagePages) },
              { label: dict.readingDays, value: String(summary.readingDays) },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-elevated)] p-3 text-center"
              >
                <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                <p
                  className="mt-0.5 text-lg font-semibold tabular-nums text-foreground"
                  title={stat.value === "—" ? dict.noData : undefined}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* Monthly chart + textual fallback */}
          <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="mb-3 text-[13px] font-medium text-foreground">{dict.byMonth}</p>
            <MonthlyChart data={chartData} label={dict.booksRead} dark={dark} />
            <span className="sr-only">
              {chartData
                .filter((m) => m.count > 0)
                .map((m) => `${m.month} ${m.count}`)
                .join(", ")}
            </span>
          </div>

          {/* Favorites */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: dict.mostReadAuthor, value: summary.topAuthor, extra: summary.topAuthorCount },
              { label: dict.mostReadGenre, value: summary.topGenre, extra: summary.topGenreCount },
              { label: dict.uniqueAuthors, value: null, extra: summary.uniqueAuthors },
              { label: dict.uniqueGenres, value: null, extra: summary.uniqueGenres },
            ].map((cell) => (
              <div
                key={cell.label}
                className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-elevated)] p-3 text-center"
              >
                <p className="text-[11px] text-muted-foreground">{cell.label}</p>
                {cell.value === null ? (
                  <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{cell.extra}</p>
                ) : (
                  <p
                    className="mt-0.5 truncate font-[var(--font-serif)] text-[15px] font-medium text-foreground"
                    title={cell.value}
                  >
                    {cell.value}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Notable books */}
          {(summary.firstBook || summary.lastBook || summary.longestBook || summary.shortestBook) && (
            <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="mb-3 text-[13px] font-medium text-foreground">{dict.notableBooks}</p>
              <ul className="space-y-2.5">
                {[
                  { label: dict.firstBook, book: summary.firstBook },
                  { label: dict.lastBook, book: summary.lastBook },
                  { label: dict.longestBook, book: summary.longestBook },
                  { label: dict.shortestBook, book: summary.shortestBook },
                ]
                  .filter((row) => row.book)
                  .map((row) => (
                    <li key={row.label} className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted-foreground">{row.label}</p>
                        <p
                          className="truncate font-[var(--font-serif)] text-[15px] text-foreground"
                          title={row.book!.title}
                        >
                          {row.book!.title}
                          {row.book!.author ? (
                            <span className="text-muted-foreground"> · {row.book!.author}</span>
                          ) : null}
                        </p>
                      </div>
                      <p className="shrink-0 text-[13px] tabular-nums text-muted-foreground">
                        {row.book!.pages === null ? "—" : `${row.book!.pages} ${dict.pagesShort}`}
                      </p>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Share/export */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onExport}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-[8px] bg-[var(--accent)] px-4 py-2 font-[var(--font-sans)] text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              <Download size={14} />
              {exporting ? dict.exporting : dict.exportSummary}
            </button>
            <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
          </div>
        </div>
      )}
    </section>
  );
}

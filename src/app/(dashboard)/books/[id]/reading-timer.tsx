// SPDX-License-Identifier: GPL-3.0-only
"use client";

// v3.4.0 — in-app reading timer for READING books. One un-flushed seconds
// buffer drives the display; whole-minute batches are flushed to the server
// every TIMER_FLUSH_INTERVAL_SEC, on pause/stop and on page hide. The session
// survives reloads via localStorage (running state + carried seconds), so an
// accidental refresh never loses tracked time. Minutes flow into
// DailyActivity.minutesRead — the combined device+app daily total.
import { useCallback, useEffect, useRef, useState } from "react";
import { logReadingSession } from "@/app/actions/timer";
import { TIMER_FLUSH_INTERVAL_SEC } from "@/lib/timer";

type TimerDict = {
  title: string;
  start: string;
  pause: string;
  resume: string;
  stop: string;
  flushed: string; // "{m}" interpolated
  flushedNothing: string;
  saved: string;
};

const storageKey = (bookId: string) => `bs-reading-timer:${bookId}`;

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function ReadingTimer({ bookId, dict }: { bookId: string; dict: Record<string, string> }) {
  const d = dict as unknown as TimerDict;
  const [running, setRunning] = useState(false);
  const [display, setDisplay] = useState(0);
  const unflushed = useRef(0);
  const runningRef = useRef(false);

  const persist = useCallback(
    (isRunning: boolean) => {
      try {
        localStorage.setItem(storageKey(bookId), JSON.stringify({ running: isRunning, unflushed: unflushed.current }));
      } catch {
        /* storage unavailable (private mode) — session simply won't survive reload */
      }
    },
    [bookId],
  );

  const flush = useCallback(
    async (keepRemainder: boolean) => {
      const seconds = unflushed.current;
      const minutes = Math.floor(seconds / 60);
      const remainder = seconds - minutes * 60;
      unflushed.current = keepRemainder ? remainder : 0;
      setDisplay(unflushed.current);
      if (minutes > 0) {
        const res = await logReadingSession(bookId, minutes * 60);
        const { toast } = await import("sonner");
        if (res.ok) toast.success(d.flushed.replace("{m}", String(res.recorded)));
        else toast.error(d.flushedNothing);
      } else if (!keepRemainder) {
        // Session ended with less than a whole minute — make it explicit.
        const { toast } = await import("sonner");
        toast.error(d.flushedNothing);
      }
      persist(runningRef.current);
    },
    [bookId, d.flushed, d.flushedNothing, persist],
  );

  // Hydrate from localStorage: a running session keeps ticking after reload.
  useEffect(() => {
    let stored: { running?: boolean; unflushed?: number } | null = null;
    try {
      stored = JSON.parse(localStorage.getItem(storageKey(bookId)) ?? "null");
    } catch {
      /* corrupt payload — start clean */
    }
    if (stored?.unflushed) {
      unflushed.current = Math.max(0, Math.floor(stored.unflushed));
      setDisplay(unflushed.current);
    }
    if (stored?.running) {
      runningRef.current = true;
      setRunning(true);
    }
  }, [bookId]);

  // One-second tick while running.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      unflushed.current += 1;
      setDisplay(unflushed.current);
      if (unflushed.current >= TIMER_FLUSH_INTERVAL_SEC) void flush(true);
    }, 1000);
    return () => clearInterval(id);
  }, [running, flush]);

  // Record partial batches when the tab is hidden/closed.
  useEffect(() => {
    const onHide = () => {
      if (runningRef.current && unflushed.current >= 60) void flush(true);
      else persist(runningRef.current);
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onHide);
    };
  }, [flush, persist]);

  function start() {
    runningRef.current = true;
    setRunning(true);
    persist(true);
  }

  function pause() {
    runningRef.current = false;
    setRunning(false);
    void flush(true);
  }

  function stop() {
    runningRef.current = false;
    setRunning(false);
    void flush(false).then(() => {
      try {
        localStorage.removeItem(storageKey(bookId));
      } catch {
        /* ignore */
      }
    });
  }

  return (
    <section className="space-y-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="font-medium">{d.title}</h2>
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-[var(--font-mono)] text-3xl tabular-nums text-foreground">{formatClock(display)}</span>
        {!running ? (
          display > 0 ? (
            <button
              onClick={start}
              className="rounded-[8px] bg-[var(--primary)] px-3 py-1.5 text-sm text-[var(--primary-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
            >
              {d.resume}
            </button>
          ) : (
            <button
              onClick={start}
              className="rounded-[8px] bg-[var(--primary)] px-3 py-1.5 text-sm text-[var(--primary-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
            >
              {d.start}
            </button>
          )
        ) : (
          <button
            onClick={pause}
            className="rounded-[8px] border border-[var(--border)] px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-[var(--accent-soft)]"
          >
            {d.pause}
          </button>
        )}
        {display > 0 && (
          <button
            onClick={stop}
            className="rounded-[8px] border border-[var(--border)] px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {d.stop}
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{d.saved}</p>
    </section>
  );
}

// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { addBook } from "@/app/actions/books";

const QUEUE_KEY = "bookshelf-pending-books";

export interface PendingBook {
  isbn?: string;
  title: string;
  author?: string;
  coverUrl?: string;
  numberOfPages?: string;
  submitToOpenLibrary?: boolean;
}

function readQueue(): PendingBook[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as PendingBook[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingBook[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Storage full or unavailable — drop silently
  }
}

export function enqueuePendingBook(book: PendingBook): void {
  writeQueue([...readQueue(), book]);
}

/**
 * Retry queued offline book adds. Runs client-side so the session cookie
 * is available. Returns how many books were successfully added.
 */
export async function flushPendingBooks(): Promise<number> {
  const queue = readQueue();
  if (queue.length === 0 || !navigator.onLine) return 0;

  const remaining: PendingBook[] = [];
  for (const book of queue) {
    try {
      const result = await addBook({
        isbn: book.isbn || undefined,
        title: book.title,
        author: book.author,
        coverUrl: book.coverUrl,
        numberOfPages: book.numberOfPages || undefined,
        submitToOpenLibrary: book.submitToOpenLibrary,
      });
      if (!result.ok) remaining.push(book);
    } catch {
      remaining.push(book);
    }
  }
  writeQueue(remaining);
  return queue.length - remaining.length;
}

/**
 * Flush now when online, and register SW Background Sync as fallback.
 * Returns a cleanup function.
 */
export function setupPendingBookSync(): () => void {
  async function flushAndNotify() {
    const added = await flushPendingBooks();
    if (added > 0) {
      const { toast } = await import("sonner");
      toast.success(added === 1 ? "Offline'daki 1 kitap eklendi" : `Offline'daki ${added} kitap eklendi`);
      window.dispatchEvent(new CustomEvent("bookshelf:books-synced"));
    }
  }

  window.addEventListener("online", flushAndNotify);
  navigator.serviceWorker?.addEventListener("message", (event) => {
    if (event.data === "sync-books") void flushAndNotify();
  });

  // Kick off immediately in case the queue predates this mount
  void flushAndNotify();

  return () => window.removeEventListener("online", flushAndNotify);
}

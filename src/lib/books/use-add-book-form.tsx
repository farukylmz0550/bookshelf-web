// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { addBook, lookupIsbnAction } from "@/app/actions/books";
import { enqueuePendingBook, setupPendingBookSync } from "@/lib/offline-queue";

export type AddBookFormDict = {
  isbn: string;
  lookup: string;
  bookTitle: string;
  author: string;
  add: string;
  pages: string;
  scan: string;
  notFound?: string;
  lookupFailed?: string;
  addSuccess?: string;
  addFailed?: string;
  required?: string;
};

/** State + logic for the one-click ISBN add form. The component only renders. */
export function useAddBookForm(dict: AddBookFormDict, options?: { onAdded?: () => void }) {
  const { onAdded } = options ?? {};
  const [isbn, setIsbn] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | undefined>();
  const [numberOfPages, setNumberOfPages] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [lookupPending, startLookup] = useTransition();
  const [addPending, startAdd] = useTransition();

  const pending = lookupPending || addPending;

  useEffect(() => setupPendingBookSync(), []);

  const clearFields = useCallback(() => {
    setIsbn("");
    setTitle("");
    setAuthor("");
    setCoverUrl(undefined);
    setNumberOfPages("");
    setLookupError(null);
  }, []);

  const handleLookup = useCallback(
    (scannedIsbn?: string) => {
      const raw = scannedIsbn ?? isbn;
      const cleaned = raw.replace(/[^0-9Xx]/g, "");
      if (!cleaned) {
        setLookupError(dict.required ?? "ISBN is required");
        return;
      }
      setLookupError(null);
      setAddError(null);
      startLookup(async () => {
        const res = await lookupIsbnAction(raw);
        if (res.ok && res.data) {
          const data = res.data;
          // Direct add — with all details, one step
          const result = await addBook({
            isbn: data.isbn || cleaned,
            title: data.title,
            author: data.author ?? undefined,
            coverUrl: data.coverUrl,
            numberOfPages: data.numberOfPages,
            publishers: data.publishers,
            publishDate: data.publishDate,
            publishPlaces: data.publishPlaces,
            languages: data.languages,
            subjects: data.subjects,
            isbn10: data.isbn10,
            isbn13: data.isbn13,
          });
          if (result.ok) {
            toast.success(dict.addSuccess ?? "Book added", { description: data.title, icon: <Check size={16} /> });
            clearFields();
            onAdded?.();
          } else {
            const msg = result.error || (dict.addFailed ?? "Could not add the book");
            setAddError(msg);
            toast.error(msg);
            // Fallback: fill form so manual correction is possible
            setTitle(data.title);
            setAuthor(data.author ?? "");
            setCoverUrl(data.coverUrl);
            if (data.numberOfPages) setNumberOfPages(data.numberOfPages);
          }
        } else if (res.ok) {
          const msg = dict.notFound ?? "ISBN not found — enter manually.";
          setLookupError(msg);
          toast.error(msg);
        } else {
          const msg =
            res.error === "NOT_FOUND"
              ? (dict.notFound ?? "ISBN not found — enter manually.")
              : (dict.lookupFailed ?? "Lookup failed. Try again.");
          setLookupError(msg);
          toast.error(msg);
        }
      });
    },
    [isbn, dict, clearFields, onAdded],
  );

  const handleAdd = useCallback(() => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setAddError(dict.required ?? "Title is required");
      toast.error(dict.required ?? "Title is required");
      return;
    }
    setAddError(null);
    startAdd(async () => {
      const bookInput = {
        isbn: isbn || undefined,
        title: trimmedTitle,
        author: author.trim() || undefined,
        coverUrl,
        numberOfPages: numberOfPages || undefined,
      };
      try {
        const result = await addBook(bookInput);
        if (!result.ok) {
          const msg = result.error || (dict.addFailed ?? "Could not add the book");
          setAddError(msg);
          toast.error(msg);
          return;
        }
      } catch (error) {
        // Network/server unreachable — queue for background sync when offline
        if (!navigator.onLine) {
          enqueuePendingBook(bookInput);
          toast.info("Offline — book saved locally, it will be added when you are back online");
          clearFields();
          if ("serviceWorker" in navigator) {
            navigator.serviceWorker.ready
              .then((reg) => {
                // Background Sync is not yet in the default TS DOM lib
                const sync = (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } })
                  .sync;
                return sync?.register("bookshelf-sync-books");
              })
              .catch(() => {});
          }
          return;
        }
        throw error;
      }
      toast.success(dict.addSuccess ?? "Book added", { icon: <Check size={16} /> });
      clearFields();
      onAdded?.();
    });
  }, [
    title,
    isbn,
    author,
    coverUrl,
    numberOfPages,
    dict.addFailed,
    dict.addSuccess,
    dict.required,
    clearFields,
    onAdded,
  ]);

  const handleScan = useCallback(
    (scanned: string) => {
      setIsbn(scanned);
      if (lookupError) setLookupError(null);
      handleLookup(scanned);
    },
    [handleLookup, lookupError],
  );

  return {
    isbn,
    setIsbn: (v: string) => {
      setIsbn(v);
      if (lookupError) setLookupError(null);
    },
    title,
    setTitle: (v: string) => {
      setTitle(v);
      if (addError) setAddError(null);
    },
    author,
    setAuthor,
    coverUrl,
    numberOfPages,
    lookupError,
    addError,
    lookupPending,
    addPending,
    pending,
    handleLookup,
    handleAdd,
    handleScan,
  };
}

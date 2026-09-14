// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { Share2, Check } from "lucide-react";
import { useState } from "react";

interface ShareButtonProps {
  title: string;
  author?: string;
}

export function ShareButton({ title, author }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const text = author ? `${title} — ${author}` : title;

    if (navigator.share) {
      try {
        await navigator.share({ title: text, text: `Book Shelf'te: ${text}` });
      } catch {
        // User cancelled
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
      title="Share"
    >
      {copied ? <Check size={16} className="text-[var(--success)]" /> : <Share2 size={16} />}
    </button>
  );
}

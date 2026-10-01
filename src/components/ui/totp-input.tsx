// SPDX-License-Identifier: GPL-3.0-only
"use client";

// v3.14.0 — shared TOTP code entry: six independent digit boxes with
// auto-advance, paste support (paste anywhere fills from that box),
// backspace-to-previous and an invalid state. Replaces the four hand-rolled
// single inputs (login form, TOTP disable, admin danger zone, admin
// self-reset). Owns NO server logic — it only reports the assembled string
// through onChange / onComplete.

import { useRef } from "react";
import type { ChangeEvent, ClipboardEvent, KeyboardEvent } from "react";

const LENGTH = 6;

export function TotpCodeInput({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  ariaLabel,
  autoFocus = false,
}: {
  /** The assembled code, 0–6 digits. */
  value: string;
  onChange: (value: string) => void;
  /** Fires when the sixth digit lands, with the assembled code (auto-submit). */
  onComplete?: (code: string) => void;
  disabled?: boolean;
  /** Visual error state (wrong code / exhausted retries). */
  invalid?: boolean;
  ariaLabel: string;
  autoFocus?: boolean;
}) {
  const boxRefs = useRef<Array<HTMLInputElement | null>>([]);

  function focusBox(index: number): void {
    boxRefs.current[Math.min(LENGTH - 1, Math.max(0, index))]?.focus();
  }

  function commit(next: string): void {
    const clean = next.replace(/\D/g, "").slice(0, LENGTH);
    onChange(clean);
    if (clean.length === LENGTH) onComplete?.(clean);
    else focusBox(clean.length);
  }

  function handleChange(index: number, e: ChangeEvent<HTMLInputElement>): void {
    const typed = e.target.value.replace(/\D/g, "");
    if (!typed) return;
    // Splice at this box: one keypress lands one digit, a paste lands many.
    const chars = value.padEnd(LENGTH, "·").split("");
    typed.split("").forEach((d, k) => {
      if (index + k < LENGTH) chars[index + k] = d;
    });
    commit(chars.join(""));
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (value[index]) {
        // Clear this box and stay.
        const chars = value.padEnd(LENGTH, "·").split("");
        chars[index] = "·";
        onChange(chars.join("").replace(/·/g, ""));
      } else if (index > 0) {
        // Empty box: clear the previous one and move to it.
        const chars = value.padEnd(LENGTH, "·").split("");
        chars[index - 1] = "·";
        onChange(chars.join("").replace(/·/g, ""));
        focusBox(index - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusBox(index - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusBox(index + 1);
    }
  }

  function handlePaste(index: number, e: ClipboardEvent<HTMLInputElement>): void {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "");
    if (text) commit(text);
  }

  const boxes = Array.from({ length: LENGTH }, (_, i) => {
    const digit = value[i] ?? "";
    return (
      <input
        key={i}
        ref={(el) => {
          boxRefs.current[i] = el;
        }}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={LENGTH}
        value={digit}
        onChange={(e) => handleChange(i, e)}
        onKeyDown={(e) => handleKeyDown(i, e)}
        onPaste={(e) => handlePaste(i, e)}
        onFocus={(e) => e.currentTarget.select()}
        disabled={disabled}
        autoFocus={autoFocus && i === 0}
        aria-label={`${ariaLabel} (${i + 1}/${LENGTH})`}
        className={`h-12 w-10 rounded-[8px] border bg-[var(--surface-elevated)] text-center font-[var(--font-mono)] text-lg text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-50 ${
          invalid ? "border-[var(--error-text)] text-[var(--error-text)]" : "border-[var(--border)]"
        } ${digit ? "font-semibold" : ""}`}
      />
    );
  });

  return (
    <div className="flex justify-center gap-2" role="group" aria-label={ariaLabel}>
      {boxes}
    </div>
  );
}

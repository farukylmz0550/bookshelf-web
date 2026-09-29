// SPDX-License-Identifier: GPL-3.0-only
"use client";

export function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className="flex w-full items-center justify-between border-b border-[var(--border)] last:border-b-0 px-4 py-3 text-start hover:bg-[var(--surface-elevated)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
    >
      <span className="font-[var(--font-sans)] text-sm text-foreground">{label}</span>
      <div
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`}
      >
        <div
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow-sm transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </div>
    </button>
  );
}

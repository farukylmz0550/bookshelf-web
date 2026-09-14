# Changelog

All notable changes to **Book Shelf** are documented here.
From **2.9.0 onward the project is in feature-freeze**: every future release is a
PATCH (bugfix / security / performance only — no behavior, schema or feature changes).

## 2.9.6 — 2026-09-14

### Fixed

- **Page-log button label & honest logging** — the button is now imperative
  ("Read 20 pages" / "{count} sayfa oku") and logs exactly what its label says:
  when fewer than a full step remains it logs the remaining pages ("18 sayfa
  oku" → 18 pages), instead of clamping silently while the toast claimed 20.
- **Streak feedback on every press** — `logPagesRead` now returns the
  recalculated streak (also on the auto-finish path) and the success toast
  shows it: "{count} pages logged · 🔥 {streak}-day streak". The day-based
  streak semantics are unchanged; the press now visibly acknowledges it.
- **Page-less books prompt for the page count first** — clicking the button on
  a book without `numberOfPages` opens a small animated modal; confirming saves
  the page count (`updateBook`) and immediately logs the reading for that book
  (up to 20 pages / the remainder). New i18n keys (`pagesPromptTitle`,
  `pagesPromptPlaceholder`, `pagesPromptInvalid`) in all 6 dictionaries.
- **Long-press menu no longer pops abruptly** — the card scales down
  (`scale-[0.97]`) while the hold is active (new `onPressStart`/`onPressEnd`
  callbacks in `useLongPress`, haptic kept) and both the long-press menu and
  the page-count modal animate in (`fade-in zoom-in-95 slide-in-from-bottom-2`).
- **Flat text-only buttons framed** — "Detailed add" toggle on the books page
  and the mobile Share icon-button now use the standard boxed style
  (border + surface + padding) instead of bare text.

### Added

- **Page-count backfill (admin)** — new `/admin` card: looks up the caller's
  books that have no `numberOfPages` but do carry an ISBN on Open Library
  (throttled, chunked ≤ 40 lookups per run) and fills ONLY `numberOfPages` —
  never overwrites user-entered metadata. Returns `{filled, notFound,
  remaining}`; the button can be pressed again while books remain. i18n in all
  6 dictionaries (`admin.pageBackfill*`).

### QA

- tsc ✅ · lint ✅ (1 pre-existing warning) · format ✅ · unit 193/193 ✅ ·
  e2e updated to the new button/modal flow ✅

## 2.9.5 — 2026-09-14

### Fixed

- **Yearly Activity heatmap forced page-level horizontal scroll on mobile** —
  the fixed-width grid (53 weeks × 10px ≈ 694px) overflowed narrow screens;
  the whole page became horizontally scrollable. Month labels + week grid now
  live in one `overflow-x-auto` area (scrolls inside the card only; legend
  stays put). Heatmap strings ("Yearly Activity", "activities", "Less",
  "More") were hardcoded English — now i18n'd in all 6 dictionaries
  (`stats.yearlyActivity/activities/less/more`).

### Removed (dead code)

- **Dead classes:** `gnome-card` (activity-heatmap, streak-widget, login,
  register) and `gnome-boxed-list(-item)` (more page) had no CSS definition
  anywhere — surfaces rendered unstyled. Replaced with the project's token
  utilities (`rounded-[12px] border border-[var(--border)] bg-[var(--surface)]`
  and the settings-form row pattern).
- **Dead files:** `src/lib/books/reading.ts` + test (legacy port, 0 imports),
  `src/components/theme-dropdown.tsx` (superseded by appearance-settings),
  `public/audio/annual/tchaikovsky-swan-lake-theme.mp3` (not in the track
  selection list) + its README row.
- **Dead exports:** `setConsentCookie` (server variant, unused), dead
  re-export block in `cookies.ts`, `isHapticSupported`, `isStreakBroken`,
  `TEMPLATE_DEFAULT_NAME`/`EXPORT_DEFAULT_NAME`, `deleteBook`,
  `getPeopleWithStats`, `AppSettingsInput`, `getStreakStatus`, `THEMES`
  (made module-private), plus the test-only cluster in `books/model.ts`
  (`newLocalKey`, `isLocalKey`, `displayIsbn`, `parseCopies`, `MAX_COPIES`,
  `checkIsbn`, `IsbnCheck`, `LOCAL_KEY_PREFIX`) and `books/tags.ts`
  (`STARTER_TAGS`, `suggestions`, `fromSubjects`, `contains`, `store`,
  `MAX_SUBJECT_TAGS`) with their now-invalid test blocks. Live exports
  (`parseRating`, `normalizeIsbn`, `isValidIsbn10/13`, `canonical`,
  `display`, `splitTags`, `show`) kept and still tested.

## 2.9.4 — 2026-09-14

### Fixed

- **React error #31 on the books list view** — the list-view header rendered
  `dict.status`, which in the `books` dictionary is a nested object
  (`{ TO_READ, READING, FINISHED }`), crashing the page with minified React
  error #31 ("Objects are not valid as a React child") whenever the list view
  was shown (`/books` and `/groups/[id]`). Pre-existing since 2.4.0. The
  header now uses the `filter` dictionary's `status` string, and the grid
  receives localized `toRead`/`reading`/`finished` labels derived from
  `books.status` (card status badges previously fell back to raw keys).
  List-view status cells now show localized labels instead of the raw
  `TO_READ`/`READING`/`FINISHED` keys. Dictionary parity test added for
  `books.status` across all 6 languages.

## 2.9.3 — 2026-09-13

### Security

- **Admin self-guard** — admins could previously approve/reject, promote/demote
  or delete **their own** account (self-lockout / self-deletion). All four
  admin actions (`approveUser`, `rejectUser`, `toggleAdmin`, `deleteUser`) now
  reject the caller's own id with an explicit error, and the user table
  disables the action buttons on the admin's own row (marked with a "you"
  label). Last-admin transactional guards unchanged. Regression tests added
  (`src/app/actions/admin.test.ts`).

### Changed

- **Light theme re-tinted — "Fine Porcelain × Burnt Ochre"** — light-theme CSS
  tokens replaced (`:root` in `globals.css`); dark theme (Ink & Copper) is
  unchanged. Follow-up hardcoded palettes updated: viewport `themeColor`,
  stats share-card + monthly chart (light variants), group color presets,
  hex-picker placeholder, `manifest.json` colors, `offline.html`. Brand SVG
  masters/icons intentionally untouched (CC BY-NC-ND).
- **Paper texture removed** — the global fractal-noise grain overlay
  (`body::after`), warm top-light wash and the `.paper-surface` box-shadow
  treatment were removed from `globals.css` and all 13 consuming components.
  Surfaces now rely on flat tokens + borders; README/UI docs updated.
- Docs updated: README (palette, badge → 2.9.3), `UI_Design_Language.md`
  §4.1 light-theme table, `MEMORY.md`.

## 2.9.1 — 2026-09-12

- **License metadata** — machine-readable `SPDX-License-Identifier` headers added
  to all GPL source files (including root configs, e2e specs and tooling
  scripts) and to the CC-BY-NC-ND brand SVG masters/icons; new root
  [`NOTICE.md`](NOTICE.md) summarizes which license applies to which path.
  Metadata only — no behavior, schema or feature changes.

## 2.9.0 — 2026-09-12

**Feature-freeze begins:** 2.9.0 and onward: patches only.

### Fixed

- **AppSettings singleton race** — admin settings update used a non-atomic
  `deleteMany` + `create`; two concurrent updates could leave two rows. The
  table is now a fixed singleton row (`id = 'singleton'`) written with a single
  atomic `upsert`; reads use the fixed id. Migration
  `20260912130000_appsettings_singleton_id` collapses any pre-existing duplicate
  rows and pins the surviving row's id — existing settings values are preserved.
- **Page-log double XP / lost progress** — `logPagesRead` overwrote
  `currentPage` from a stale read and awarded XP unconditionally, so a
  double-tap (or two devices) could award XP twice while one write was silently
  lost. The write is now an optimistic lock (`updateMany` matching the read
  `currentPage`); on conflict the call returns
  `{ ok: false, error: "Conflict, please retry" }` and awards nothing. The
  auto-finish branch gained the same lock plus a `status != FINISHED` guard so
  a concurrent duplicate can never add a second read event or second finish XP.
- **Finish XP idempotency guard** — `finishBookWithXp` now re-verifies
  ownership + `FINISHED` status fresh from the DB and holds a short (10 s)
  in-process claim per book, so a duplicate invocation right after a
  legitimate finish awards nothing. Re-read flows are unaffected.
- **Group order race** — `createGroup` computed the new group's `order` from a
  non-atomic max-read; the aggregate + create now run inside one transaction.

### Security

- Dependency supply-chain pass — `npm audit` reports **0 vulnerabilities**:
  - `mysql2` → `^3.24.4` via `overrides` (GHSA-3f6p-5ww8-9rcr, GHSA-rgwj-5xj2-c3m3 — high; pulled by the Prisma CLI's unused MySQL driver)
  - `deepmerge-ts` → `^8.0.2` via `overrides` (GHSA-ggr8-5vv4-36mx — high; via `@prisma/config`)
  - `uuid` → `^11.1.1` via `overrides` (GHSA-w5hq-g745-h8pq — moderate; via exceljs)
  - `prisma` stays on 7.10.0 (latest 7.x; no patched 7.x exists and a 6.x
    downgrade would break the current schema), `exceljs` stays on 4.4.0
    (no newer release).

## 2.8.0 — 2026-09-12

- **Groups / Shelves** — first-class personal grouping: create/rename/delete/
  reorder groups with optional colors, many-to-many book membership,
  dedicated `/groups/[id]` grid views, group filter on the main Books page
  (AND semantics with tags/status/search), book-detail membership chips,
  ownership-scoped actions, 6-language i18n.

## 2.7.0 — 2026-09-11

- Annual Reading Summary (Jan 1–7 window, read-event metrics, PNG share card,
  CC0 mood music), reading rules (page-log button, auto-FINISH at all pages
  read, re-read counting, early-finish block), yearly goal lock, goal-progress
  push notifications, admin-editable AppSettings.

## 2.6.0 — 2026-09-11

- Goodreads CSV import (ISBN13-first, shelf→status/tags mapping, Open Library
  enrichment).

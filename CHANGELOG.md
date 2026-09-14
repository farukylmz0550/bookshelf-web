# Changelog

All notable changes to **Book Shelf** are documented here.
From **2.9.0 onward the project is in feature-freeze**: every future release is a
PATCH (bugfix / security / performance only — no behavior, schema or feature changes).

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

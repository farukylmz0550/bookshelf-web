# Changelog

All notable changes to **Book Shelf** are documented here.
The 2.9.x feature-freeze was lifted with 2.10.0. The 3.x series starts with
3.0.0 (breaking: site-wide values moved out of the database; see below).

## 3.4.0 — 2026-09-19

### Added

- **In-app reading timer (Faz 4 — "UX derinlik")** — READING books get a
  session timer on the detail page (start/pause/resume/stop, reload-safe via
  localStorage). Whole-minute batches flush to the server every 5 minutes
  (`logReadingSession` → `recordActivity`) and join `DailyActivity.minutesRead`,
  the same column Kobo device minutes use, so Stats shows one combined total.
  Anti-farm: ≤90 min per flush and a combined 1440 min/UTC-day cap
  (`lib/timer.ts`); minutes give no XP, consistent with the Kobo write-back.
- **Book quotes** — new `Quote` model (migration
  `20260919093000_book_quotes`: text, optional page ref, denormalized
  `bookTitle` snapshot, CASCADE on book delete). Quotes section on the book
  detail page: add, edit in place, confirm-guarded delete; ownership-scoped
  actions (`actions/quotes.ts`, validation in `lib/quotes.ts`).
- **kepubify (EPUB → KEPUB)** — with `config.yaml → kobo.kepubify: true`, the
  Kobo sync advertises a KEPUB download (`/download/{id}/kepub`) and converts
  lazily on first request with the `kepubify` binary (bundled in the Docker
  image, `KEPUBIFY_PATH` to override). Conversions cache in
  `<data dir>/cache/kepub/<bookId>.kepub.epub` (atomic placement) and are
  invalidated when a book's Kobo metadata hash changes; disabled by default —
  `kepub` requests return 404 and metadata stays EPUB-only.

### QA

- tsc ✅ · lint ✅ (1 pre-existing warning) · unit 269/269 ✅ (new: `timer.test.ts`
  rounding/caps, `quotes.test.ts` validation, `kepub.test.ts` cache paths) ·
  e2e 57/57 ✅ (new: `reading-timer.spec.ts` ×2, `quotes.spec.ts` ×3, kepub
  disabled-path in `kobo-sync.spec.ts`) · build ✅ · migration
  `20260919093000_book_quotes` ✅

## 3.3.0 — 2026-09-18

### Added

- **Seasonal challenges (Faz 3 — "Challenges + imports")** — free-form reading
  challenges ("Winter: 5 books") with a target number of read events inside a
  date window (`/challenges`, new `Challenge` model, migration
  `20260919000000_seasonal_challenges`). Progress derives from
  `BookReadEvent.readAt` (canonical counting, same as goals); completion is
  exactly-once via a conditional guard and awards config-defined XP
  (`config.yaml challenges.completionXp`, default 25). Challenges can be
  deleted from the card (confirm-guarded, ownership-scoped).
- **Calibre + StoryGraph CSV import** — the unified "Import CSV" button now
  accepts Goodreads, Calibre and StoryGraph exports. Format is detected from
  the header row (unknown layouts rejected, not guessed); Calibre's
  pages/series/publisher and StoryGraph's read status/pages map into the
  shared pipeline (dedupe, Open Library enrichment, XP) unchanged.
- **Automatic DB backup** — the Docker cron container now also calls
  `POST /api/backup` daily (Bearer CRON_SECRET): an online WAL-consistent
  better-sqlite3 `.backup()` copy into `/data/backups`, newest 7 files kept
  (`bookshelf-YYYYMMDD.db`, prune beyond retention).

### QA

- tsc ✅ · lint ✅ (1 pre-existing warning) · unit 255/255 ✅ (new
  `challenges.test.ts`: challenge validation/progress, CSV detection +
  Calibre/StoryGraph parsing, backup helpers, config) · e2e 51/51 ✅ (new
  `challenges.spec.ts`: create, exact-once completion, confirm-guarded delete) ·
  build ✅ · migration `20260919000000_seasonal_challenges` ✅

## 3.2.0 — 2026-09-18

### Added

- **OPDS 1.2 catalog (Faz 2 — "Library intelligence")** — `/api/opds/<token>/`
  serves your whole library as an OPDS 1.2 catalog to any compatible reader
  app (Moon+ Reader, KOReader, Foliate, …). Same per-user capability token as
  the Kobo sync (Settings shows both URLs). Root = navigation feed
  ("All books" + one entry per series + per author); acquisition feeds carry
  covers and the EPUB download link streamed from the user's own
  fileSourceUrl template. Token-keyed rate limit, public in the proxy
  middleware, gated by `kobo.enabled` in config.yaml.
- **Series view** (`/series`) — the Open Library `series` data already in the
  library becomes navigable: cards with finished/total progress bars and a
  detail grid per series (`/series/[name]`, ownership-scoped). Sidebar "More"
  + bottom-nav overflow entries in all 6 dictionaries.
- **Authors view** (`/authors`) — the caller's books grouped by author
  (derived, no new tables): card counts (finished/reading) and a per-author
  detail grid (`/authors/[name]`).
- New pure helpers `src/lib/collections.ts` (groupSeries/groupAuthors) and
  `src/lib/opds.ts` (Atom/XML feed builders, XML-escaped), both unit-tested.

### QA

- tsc ✅ · lint ✅ (1 pre-existing warning) · unit 242/242 ✅ (new: opds.test.ts
  grouping + feed XML) · e2e 48/48 ✅ (new: library-intelligence.spec.ts) ·
  build ✅ (no schema change — derived views only)

## 3.1.0 — 2026-09-18

### Added

- **Kobo delta sync (v3.1.0 completion)** — per-book sync state
  (`KoboSyncedBook`): new books arrive as `NewEntitlement`, books whose
  metadata changed (title/author/cover/ISBN/pages/…) re-push as
  `ChangedEntitlement` with the same entitlement id (no re-download),
  and progress-only changes never re-push (no sync loop). A book that leaves
  the library sends `IsRemoved: true` and the tombstone row clears itself —
  removal sync is dormant until a delete feature exists, then it works
  automatically. Deleting a book **on the device** now archives it there
  (`KoboSyncedBook.archivedAt`) instead of being ignored; the library keeps
  the book and the device stops re-downloading it.
- **Device reading-time write-back** — `Statistics.SpentReadingMinutes`
  (cumulative, device-sent) is stored per book (`Book.koboSpentMinutes`) and
  its per-sync delta feeds `DailyActivity.minutesRead`; re-reported identical
  totals are idempotent (no XP/time inflation) and minutes-only reports award
  no page XP. Stats gains a **Reading time** tile (`formatReadingMinutes`)
  and the activity-heatmap tooltips show daily minutes (`25 min`).
- **Custom level names** — `config.yaml xp.levels.names` (optional list,
  index 0 = level 1): shown in Stats, the leaderboard and the profile instead
  of "Level N". One language (site owner's choice); missing entries fall back
  to the default label. Invalid/empty entries are dropped field-by-field.
- `kobo:sim` gained delta-sync and reading-minute checks.

### QA

- tsc ✅ · lint ✅ (1 pre-existing warning) · unit 236/236 ✅ · e2e 44/44 ✅ ·
  build ✅ · migration `20260918000000_kobo_sync_v3_1` (KoboSyncedBook +
  Book minutes columns + DailyActivity.minutesRead) ✅

## 3.0.0 — 2026-09-17

### Breaking

- **config.yaml is the single source of site-wide values** — the `AppSettings`
  table and the admin panel's Reading Settings card are gone. Reading, XP,
  level-curve, backfill and Kobo values now live in
  [`config.yaml`](config.yaml) (repo root; mounted read-only into the Docker
  container — edit the host copy and restart). The `READ_EVENT_PAGES` and
  `XP_*` environment variables are no longer read. Existing deployments keep
  working with code defaults identical to the v2.7.0 values; admin-customized
  values must be transcribed into `config.yaml` once.
  Migration: `20260917200000_drop_appsettings_add_kobo_sync`.
- **Kobo sync token model** — new `KoboSyncToken` and `User.fileSourceUrl`
  (same migration; existing rows untouched).

### Added

- **Kobo eReader sync (experimental)** — a customer-requested integration:
  the device's `api_endpoint` (`.kobo/Kobo/Kobo eReader.conf`) is pointed at a
  per-user BookShelf sync URL, and the reader pulls the whole library straight
  from the server. Metadata + covers sync over the Kobo sync protocol;
  book files stream from **the user's own URL template** (Settings →
  Kobo Sync; `{isbn}` / `{isbn10}` / `{isbn13}` placeholders) so the books
  live wherever the NAS keeps them. Device-reported reading progress writes
  back into BookShelf: `currentPage`, streak activity, per-10-pages XP and
  the exactly-once automatic FINISH. Deleting on the device never deletes
  from the library. Unimplemented store requests are proxied to the real Kobo
  store by default (`kobo.storeProxy`) so store features keep working.
  Endpoints: `/api/kobo/<token>/v1/auth/device`, `/v1/initialization`,
  `/v1/library/sync`, `/v1/library/{id}/metadata`, `/v1/library/{id}/state`,
  `/download/{id}/epub`, cover images. Path-token auth (public in the proxy
  middleware, token-keyed rate limit). Simulation-tested against the
  calibre-web protocol reference — **not hardware-verified**; feedback from
  real devices is expected. New `scripts/kobo-sim.ts` (`npm run kobo:sim`)
  replays the full device flow for self-hosters without a spare eReader.
- **Settings → Book data** — "Sayfa sayısı doldurma" (Open Library page-count
  backfill, v2.9.6) moved from Admin to Settings: it fills the caller's own
  books, so it was never an admin power. Chunk sizes now come from
  `config.yaml` (`backfill.chunkSize` / `maxBatch`).
- **Settings → Kobo Sync card** — create/rotate the device sync URL, enter
  the book-file URL template, device setup instructions (6 languages).

### Fixed

- Race-safety suite trimmed of the removed settings-singleton cases; the
  page-log/finish/group concurrency guarantees are unchanged.

### QA

- tsc ✅ · lint ✅ (1 pre-existing warning) · unit 226/226 ✅ (16→17 files,
  incl. new Kobo device-flow simulation + app-config validation) · migration
  `20260917200000_drop_appsettings_add_kobo_sync` drops AppSettings and adds
  the Kobo tables ✅ · Docker: `config.yaml` volume-mounted read-only,
  default file baked into the image ✅

## 2.11.0 — 2026-09-16

### Added

- **Permanent + monthly achievements** — `Achievement.recurrence` (NONE /
  MONTHLY) and period-based unlock records (`UserAchievement.periodKey`:
  `""` = permanent, `"YYYY-MM"` = monthly UTC period; unique per
  user+achievement+period). Catalog grows 8 → 21: finishing milestones
  (10/25/50/100 books), lifetime page totals (1k/5k/10k), first shelf, first
  yearly-goal completion, and five re-earnable monthly achievements
  (3 or 5 books finished, 500 pages, 7 distinct reading days, monthly goal
  completion). Every achievement has an explicit XP value (single
  `ACHIEVEMENT_XP` map); monthly XP re-awards each period automatically — no
  cron, period keys roll over with the calendar.
- **Exactly-once unlock engine** — `syncAchievements()` evaluates permanent
  and monthly rules from one pure evaluator (lifetime + UTC-period stats:
  finishedAt-based finishes, DailyActivity pages/days, goal read events) and
  creates unlock rows + XP in a single transaction, so repeated
  synchronization never duplicates achievements or XP. New sync hooks:
  createGroup, addBooksToGroup, confirmGoals.
- **Achievements UI** — monthly achievements carry a localized "Monthly"
  badge and an earns-again-next-month hint; previous months remain as
  historical records.
- **Books page reading CTA** — a header "Read N pages" button, visible as
  soon as the page opens while a READING book exists; one tap logs the
  configured step for a single reading book, multiple books get a picker, and
  page-less books reuse the page-count prompt.

### Fixed

- **Seed drift** — the Docker seed (`seed.cjs`) referenced a stale
  `streak_shield` achievement instead of `century_streak`; the catalog is now
  generated from the shared rule set and the entrypoint seeds idempotently on
  every boot, so new achievements reach existing deployments.

### QA

- tsc ✅ · lint ✅ (1 pre-existing warning) · format ✅ · unit 212/212 ✅ ·
  e2e 42/42 ✅ · migration `20260916150239_achievement_recurrence_and_periods`
  preserves existing achievement history ✅

## 2.10.1 — 2026-09-15

### Added

- **Troubleshooting guide** — new root [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md):
  symptom → cause → fix documentation for self-hosting and daily use, covering
  Docker startup failures (readonly data volume, crash-loop, UntrustedHost,
  relative DATABASE_URL), backups, the full rate-limit table, lost-authenticator
  recovery commands for TOTP, manual admin password reset, admin guards,
  ISBN/lookup failures, lending and import errors, cookie-gated theme
  persistence, notifications/cron, PWA offline behavior and dev-environment
  recipes. Linked from the README Quick Start.

### QA

- `format:check` ✅ · `lint` ✅ (1 pre-existing warning)

## 2.10.0 — 2026-09-15

The 2.9.x feature freeze is lifted — this is the first feature release since
2.9.0.

### Added

- **Shelves (formerly Groups)** — user-facing "Groups" copy is now "Shelves"
  ("Raflar" / "Estanterías" / …) in all 6 dictionaries. Routes, data model and
  code identifiers are unchanged.
- **Bulk shelf picker** — every shelf row (and the empty shelf page) has a "+"
  button opening a large (~80% viewport) centered dialog: searchable book grid,
  tap-to-select, books already on the shelf marked, single "Add (n)" action.
  New actions `listBooksForShelfPicker` / `addBooksToGroup` (ownership-scoped,
  duplicate-safe). i18n (`groups.pick*`, `groups.onShelf`, `groups.addCount`,
  `groups.addedManyToast`) in all 6 dictionaries.
- **TOTP two-factor authentication** — optional per user (Settings → Security):
  QR enrollment (`otplib` + `qrcode`), ±30 s verification tolerance, per-account
  attempt throttling. Mandatory for admin accounts: production deployments
  block the dashboard behind a non-closable setup gate until 2FA is on and
  admins cannot disable it. Login flow: `authorize()` answers `TOTP_REQUIRED`,
  the login form reveals a 6-digit field and resubmits. New User fields
  `totpSecret`, `totpEnabled`, `mustChangePassword` (migration
  `20260915153612_add_totp_and_must_change_password`).
- **Admin danger zone** — `/admin` card deletes every non-admin account (and,
  through cascades, their books/shelves/lending/goals/achievements) after the
  caller enters a fresh TOTP code; admin accounts, the achievement catalog and
  app settings survive.
- **Admin-assigned password resets** — no email channel, so an admin generates
  a random 12-character password per user (shown once, copyable) and the user
  is forced to set a new password through a large blocking dialog at next
  login (`mustChangePassword`). Login page gains a "contact your
  administrator" hint.
- **Project licensing section** — the in-app Licenses page now documents the
  trademark status of the Book Shelf name, the CC-BY-NC-ND-4.0 logo/brand
  license and the CC0-1.0 rendered music, next to the GPLv3 source-code
  notice. README license section gains the music CC0 paragraph.

### Fixed

- **Native select dropdowns** — all remaining native `<select>` elements (book
  detail status, books filter bar ×8, lending form, annual summary year) now
  use the styled Base UI `Select` component: themeable portal popups instead
  of the browser's unstyled white dropdown that overlapped page content.
- **Stale-session guard** — the dashboard layout signs a user out when the
  session id no longer exists in the database (e.g. after a wipe).

### QA

- tsc ✅ · lint ✅ (1 pre-existing warning) · unit 193/193 ✅ · e2e updated
  (Base UI select helper `e2e/helpers/ui-select.ts`, shelf copy) and green ✅

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

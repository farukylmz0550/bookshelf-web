# Changelog

All notable changes to **Book Shelf** are documented here.
The 2.9.x feature-freeze was lifted with 2.10.0. The 3.x series starts with
3.0.0 (breaking: site-wide values moved out of the database; see below).

## 3.14.0 — 2026-10-01

### Added

- **Popup system (PopupShell).** One opinionated popup pattern over the shadcn
  Dialog (`ui/popup.tsx`): consistent 85 dvh max-height + scroll, safe-area
  padding, standard header. The approved popup locations are documented in the
  component header — decided with the user: QR login generation and TOTP entry
  are SEPARATE popups (never merged); lending book selection stays a dropdown;
  profile password change stays inline; `/pair/<token>` (phone side) stays a
  full page; lending history/returns stay inline.

- **QR login popup with a 30 s auto-renewing code.** The Settings card is now a
  trigger only — generation happens in its own popup. Opening it generates a
  session immediately; when the 30 s token expires the QR renews
  automatically (the visible code is always in-window), and closing the popup
  cancels the open session so a half-issued token can't stay confirmable.
  `QR_LOGIN_TTL_SECONDS` is 60 → 30. Account binding was verified: the token
  has always been scoped to the creating user's id (no change needed there).

- **In-place borrower creation on /lending.** Creating a borrower no longer
  navigates to /people — a popup on the lending page takes a name, creates
  the person, pre-selects them in the dropdown (the action now returns the
  fresh person) and toasts confirmation. This intentionally relaxes UI Design
  Language §2 "One Place, One Purpose" (user decision, 2026-09-30): /people
  remains the management page for rename/remove.

### Changed

- **TOTP entry redesigned — shared `TotpCodeInput` (×6 boxes).** Six digit
  boxes with auto-advance, paste support, backspace-to-previous, invalid
  state and auto-submit on the sixth digit. Replaces the four hand-rolled
  single inputs: the login form's verification step (now its own popup with
  the stashed credentials re-sent in the same signIn call), TOTP disable,
  admin danger zone and the admin self-reset dialog.

- **Mobile /books: locked toolbar, scrolling cards.** The page header,
  page-log CTA, filter toolbar and the count/view row are pinned in ONE
  sticky block below the mobile header (server-rendered header/CTA passed
  into `BooksGrid` as slots); the card list is the only scrolling element.
  Desktop keeps the plain flow (`md:static`).

### Removed

- **Dead-code sweep** (audit report: `~/.opencode/plan/dead-code-report.md`):
  8 unused shadcn UI components (badge, card, separator, sheet, skeleton,
  table, tabs, textarea); dead exports `importGoodreadsCsv`, `getTotpStatus`,
  `verifyCallerTotp`, `hashSecretValue`, `invalidateAppConfigCache`, the
  `void opdsBookEntryXml` suppressor; dead i18n keys `books.pagesLeft` /
  `books.nextBookCta` (typed + fed in 4 server pages but never rendered) and
  their unused `CardDict` fields; over-wide `gamification` re-exports trimmed.
- **Dependencies:** `next-themes` removed (no ThemeProvider — its `useTheme`
  in the Toaster was inert; colors are CSS-variable driven), `@types/bcryptjs`
  removed (bcryptjs v3 ships its own types), `shadcn` CLI moved to
  devDependencies. The licenses page attribution updated accordingly.

### Fixed

- **e2e infrastructure unblocked (57/57).** The Playwright `webServer` spawn
  timed out because the machine has no `npm` binary on PATH (Fedora ships
  nodejs without the npm package) — the command now runs the local
  `node_modules/next/dist/bin/next` directly and probes `127.0.0.1`
  (`localhost` resolves to `::1` first). `.env` no longer pins
  `NEXTAUTH_URL` (Auth.js infers the origin; the pinned port-3000 URL would
  have pointed auth callbacks at a foreign app when running on
  `PLAYWRIGHT_PORT`). `challenges.spec.ts` switched its progress assertion
  to an exact `0/2` match (the loose regex also matched the "11/30/2026"
  date range and tripped strict mode).

- **Settings → Notifications is now localized.** The card read
  `dict.settings.notif*` keys that were never passed through from the server
  page, so every locale silently fell back to hardcoded English. The keys
  already existed in all 7 dictionaries — they are wired now.
- `getConsent()` un-exported (internal helper of `hasConsent()`); test-only
  parity exports (`parseRating`, `parseShelves`, `markQrLoginScanned`) kept —
  legacy-parity contract, exercised by unit tests.

## 3.13.0 — 2026-09-29

### Added

- **Arabic (العربية) — 7th locale, with full RTL.** Complete Arabic dictionary
  (597 keys, 100% parity with English). The `<html>` element gets
  `dir="rtl"` for `ar` (all other locales keep `ltr`). A **full RTL audit**
  converted every physical direction class to Tailwind's logical
  equivalents — `ml-auto → ms-auto`, `pl/pr → ps/pe`, `text-left/right →
  text-start/end`, absolute `left/right → start/end`, dialog/sheet/table
  close-button and chevron sides — so LTR locales render byte-identically
  while Arabic mirrors correctly. **Noto Sans Arabic** joins the font stack
  (`--font-sans`, `--font-serif` fallback chain) so Arabic text stays in the
  design language instead of falling back to system fonts.
- **Dictionary parity test** (`src/lib/dictionaries.test.ts`): every locale
  must expose the exact same key set as `en.json` with non-empty values —
  Project_Rules §15 is now automatically enforced; 16 tests. CONTRIBUTING
  updated to point at it.

### Upgrade

> Personal deployment (`~/BookShelf`): run **`bookshelfupdate`** — or bump the
> image tags to `3.13.0` in `docker-compose.yml` (both `app` and `cron`), then
> `docker compose pull && docker compose up -d`. Nothing else — Settings →
> Language now offers العربية; existing users keep their current locale.

## 3.12.2 — 2026-09-29

### Fixed

- **Light theme inverted on phones in system dark mode.** The browser's own
  forced-dark feature (Chrome → Settings → Themes → "Darken websites"; works
  independently of the Android-level "Override force-dark" toggle) auto-inverts
  light pages when the system is dark — producing muddy, banded rendering.
  The page now **declares its color scheme to the engine**: dynamic
  `<meta name="color-scheme">` (pinned light → `light`, pinned dark → `dark`,
  system → `light dark`) plus `color-scheme: light / dark` CSS driven by the
  theme class (`:root` / `.dark`). Chromium and Gecko both honor the
  declaration: forced-dark inversion is skipped and native widgets
  (scrollbars, form controls) draw in the right scheme. Documented in
  TROUBLESHOOTING §13, including the guaranteed on-device fix.

### Upgrade

> Personal deployment (`~/BookShelf`): run **`bookshelfupdate`** — or bump the
> image tags to `3.12.2` in `docker-compose.yml` (both `app` and `cron`), then
> `docker compose pull && docker compose up -d`. On the phone, fully close and
> reopen the PWA once. If a light-theme page still renders inverted: Chrome →
> Settings → Themes → turn OFF "Darken websites" (see TROUBLESHOOTING §13).

## 3.12.1 — 2026-09-29

### Fixed

- **Stale PWA hybrid pages (theme mismatch).** The service worker's navigation
  cache could serve an OLD document after a network hiccup while fresh RSC
  pieces (Settings' theme radio) revalidated over it — producing a hybrid
  page: old `<html>` theme class + new UI state (seen as "Light selected but
  dark screen", plus a copper band where the stale document's theme-color
  bleeds through). The server was verified correct for every cookie state
  (live curl checks); the bug was purely client-side caching.
  - **Fix:** `CACHE_NAME` bump (`bookshelf-v5` → `bookshelf-v6`) — activating
    the new worker deletes all older caches; the PWA then always reloads from
    the network. No code behavior changed; cache hygiene only.
- **Docs sweep (outdated references):** README version badge, theme row
  (Sun/Moon → System auto), stack/tech table (`light/dark/system` + QR login),
  compose tag example; MEMORY header (3.10.0 → 3.12.1), theme action row,
  file-structure notes, commit history (3.10.2 → 3.12.0 entries), known
  issues (stale-PWA-hybrid lesson); TROUBLESHOOTING §13 rewritten — stale-page
  section + PWA cookie-sharing note for QR pairing (WebAPK ↔ Chrome share
  cookies; Firefox/Safari PWAs separate).

### Upgrade

> Personal deployment (`~/BookShelf`): run **`bookshelfupdate`** — or bump the
> image tags to `3.12.1` in `docker-compose.yml` (both `app` and `cron`), then
> `docker compose pull && docker compose up -d`. On the PHONE: when the "New
> version available" toast appears, tap it and let the page reload once (this
> wipes the old service-worker cache — the stale-theme fix reaches the PWA
> here). No other actions needed.

## 3.12.0 — 2026-09-29

### Added

- **Passwordless QR login.** Settings → Security gains a "Sign in with QR"
  card: the desktop generates a **60-second, single-use, 256-bit CSPRNG**
  token (stored hash-only, never logged), renders the pair URL as a QR and
  tracks the state live (waiting → scanned → signed in, with auto-regenerate
  on expiry). The phone scans the QR, opens `NEXTAUTH_URL/pair/<token>` and
  gets an explicit **confirmation screen** (account + device + [Sign in] /
  [Cancel]) — scanning alone never authenticates. Confirmation atomically
  consumes the token (conditional update — two parallel confirmations yield
  exactly one session) and issues a **normal NextAuth JWT session**, reusing
  the existing auth lifecycle; no second auth system. QR payload contains
  only the temporary token — no passwords, keys or session data.
- Rate limiting: `/pair/` page and confirm attempts share a tight per-IP QR
  budget (`10/min`); trusted client IP now prefers `cf-connecting-ip` behind
  Cloudflare so per-device limits work through the tunnel.

### Upgrade

> Personal deployment (`~/BookShelf`): run **`bookshelfupdate`** — or bump the
> image tags to `3.12.0` in `docker-compose.yml` (both `app` and `cron`), then
> `docker compose pull && docker compose up -d`. The `QrLoginSession` table is
> created by the automatic boot migration; no data or settings actions needed.

## 3.11.2 — 2026-09-29

### Fixed

- **TOTP login deadlock.** With 2FA enabled, the throttle check ran before the
  code-less step, so every correct-password attempt consumed one of the 5
  attempts per 5 minutes — and when the budget ran out, `authorize()` returned
  null, the form showed "invalid credentials", reset itself and **the code
  field never appeared again**, while each retry kept the counter maxed (an
  endless lockout, seen on mobile). Now:
  - the code-less step throws `TOTP_REQUIRED` without burning a slot;
  - a blocked attempt throws a distinct `TOTP_THROTTLED` — the login form
    explains "wait 5 minutes" and keeps the code field visible;
  - a successful code clears the per-account counter.
- Regression-tested: `auth-totp.test.ts` runs the real `authorize()` against
  an isolated migration-built DB (3 tests, including the no-slot-consumed and
  distinct-throttle-error matrix).

### Upgrade

> Personal deployment (`~/BookShelf`): `bookshelfupdate` — or manually
> `cd ~/BookShelf`, set the image tag to `3.11.2` in `docker-compose.yml`,
> then `docker compose pull && docker compose up -d`. Migrations run at boot;
> no data actions needed. After the update, re-enable 2FA in Settings →
> Security if it was disabled during the lockout.

## 3.11.1 — 2026-09-29

### Fixed

- **Pinned themes are no longer overridden by the OS preference.** The
  v3.11.0 no-flash script ran unconditionally and forced the `dark` class on
  every load from the raw `prefers-color-scheme` — so a pinned light theme
  showed dark on a dark-mode phone (and vice versa). The script now renders
  **only for the System theme**; pinned light/dark keep the server-rendered
  class as the single authority.
- **Theme changes now take a full page reload.** The theme class is
  server-rendered on `<html>` and the system-theme script is an inline
  `<head>` script — inline scripts don't re-execute on client-side
  navigations, so switching themes inside the SPA could leave a stale class.
  Settings reloads the page after saving the theme.

### Changed

- **"Read N pages" → "I've read N pages"** (`books.logPagesButton`, all 6
  dictionaries; Settings → Reading step description updated to quote the new
  label).
- **TROUBLESHOOTING §13 (Material You launcher tint)**: step-by-step guide —
  reinstall the PWA so Chrome bakes the current monochrome icon into the
  WebAPK, enable Themed icons, verify via `about://webapks`. The monochrome
  icon itself was verified byte-identical to the brand master; Chrome's
  WebAPK monochrome gap (crbug 40277264) remains the blocker.

## 3.11.0 — 2026-09-29

### Changed

- **Theme system: new "System (auto)" default + desktop/PWA consistency.** The
  theme previously lived only in a per-browser cookie and fell back to hard
  light — so a fresh PWA install stayed light even in OS dark mode, while the
  desktop browser (where dark was once chosen) stayed dark. Now:
  - `Theme` gains `"system"`; a missing/invalid cookie means system. The OS
    `prefers-color-scheme` is resolved by a no-flash inline script (applied
    before first paint, live-tracks OS changes, and keeps the meta
    `theme-color` in sync).
  - Settings → Appearance now offers **Light / Dark / System** with
    localized labels in all 6 dictionaries (`theme.system` added; unused
    `lightContrast`/`darkContrast`/`amoled` keys removed). Selecting System
    deletes the theme cookie (pin removal), not a stored "system" value.
  - The PWA title/status-bar color now follows the app's actual theme cookie
    (`generateViewport`) instead of the raw OS preference — a pinned dark
    theme shows the dark bar even in a light-mode OS.

### UI

- **"Read N pages" is now a prominent primary CTA.** The page-level button on
  /books was a small outline chip (28px); it is now the accent-filled primary
  action (44px touch target, `text-base`, 18px icon, full-width on mobile,
  still centered). The long-press menu's "Read N pages" row on book cards gets
  the same accent fill + 16px icon + `py-2.5`; "Re-read" stays calm. All
  colors use palette tokens only (`--accent`, `--accent-hover`,
  `--accent-foreground`).

## 3.10.2 — 2026-09-29

### Fixed

- **Filter bar no longer overflows narrow screens.** The single-row toolbar
  (search input + sort + direction + filters) forced a horizontal scroll on
  mobile because the search input's intrinsic min-width wouldn't shrink.
  Below `sm` the search input now takes its own full-width row (`w-full
  min-w-0`); the row and controls are unchanged from `sm` up.

## 3.10.1 — 2026-09-28

### Fixed

- **Ghost-session logout no longer crashes the dashboard (React #441).** When
  a session cookie referenced a user that no longer existed in the database
  (e.g. after a DB restore), the dashboard layout called `signOut()` during
  server-component render. Next 16 only permits cookie writes inside Server
  Actions and Route Handlers, so the render threw `E1180` — visible in
  production only as `Minified React error #441`. The sign-out now lives in a
  dedicated `/api/logout` route handler and the layout redirects to it.

## 3.10.0 — 2026-09-28

### Changed

- **UI plan Faz 5 — page-level refinement sweep** (§12: shared design
  language, page-specific workspaces):
  - Sidebar group headings are localized ("Library" / "Discover" / "Admin"
    in all 6 dictionaries).
  - The streak widget's shield confirm is localized; its inactive colors
    use surface tokens.
  - Design-token cleanup: the admin user table, card dialogs, the next-book
    dialog and the Excel labels now use the `--surface` / `--surface-elevated`
    / `--border` tokens instead of shadcn `bg-card` / `bg-muted` classes.
  - Removed the unused `logout-button.tsx` (logout lives in Settings).

## 3.9.0 — 2026-09-28

### Changed

- **UI plan Faz 3 — Book cards** (`UI_Improvement_Plan.md` §4/§5): the card
  is now calm — cover, title, author, subtle metadata (stars, shelf dots)
  and one status indicator. The "Log N pages" and "Re-read" action buttons
  and the "N pages left" line moved out of the permanent layout:
  - Reading books: the long-press menu gains "Log N pages" (page-less books
    keep the save-count-and-log prompt).
  - Finished books: the long-press menu gains "Re-read".
  - The book detail page keeps every action.
  - Status swipe and the status badge stay.
- "Signed" cover badge is localized in all 6 dictionaries.

## 3.8.0 — 2026-09-28

### Changed

- **UI plan Faz 2 — Books page hierarchy** (`UI_Improvement_Plan.md` §2/§3):
  - The add-book workflow moved out of the collection flow behind a primary
    **"+ Add book"** action that opens a dialog hosting the full panel:
    quick ISBN/title/author form, detailed add, and the Excel/CSV
    import-export controls (hierarchy change, not feature removal — the
    dialog closes after a successful add).
  - The page header now shows the title and the plain book count; the count
    text no longer doubles as the add action.
  - **Filter bar flattened** — no card wrapper (§10); the toolbar is now
    `Search + Sort + direction + Filters`, with sort promoted to a primary
    control; advanced filters stay behind the Filters toggle.
  - The filter/sort triggers resolve their closed-state labels explicitly
    (same treatment as v3.7.0's SelectValue fix).
- **e2e helper `openAddBook`** — specs open the dialog before using the
  book form; Excel/CSV controls are exercised inside the dialog.

## 3.7.0 — 2026-09-27

### Added

- **`UI_Improvement_Plan.md`** — phased UI roadmap (19 sections): collection
  first, management secondary; card simplification, filter-bar simplification,
  sidebar grouping, quieter active states, accent/radius unification. Phase 1
  ships in this release; Phases 2–5 follow as minor releases.
- **Settings → Account card** — user name + email and the logout action now
  live in Settings (UI plan §6); the sidebar footer and the mobile header ⏻
  button are gone. Logout asks a localized confirm.

### Changed

- **Full Turkish (and other locales) coverage** — notification settings
  ("Enable notifications", "Streak reminders", "Weekly digest", "Goal
  progress reminders", "Send test push" + toasts), "On Loan" badges
  (grid + card), view-switch aria labels, "Create account", "About" /
  "Licenses" and the logout confirm are localized in all 6 dictionaries.
- **"N pages read" CTA centered** on `/books` between the add panel and the
  list toolbar (desktop placement).
- **Select dropdowns no longer show raw IDs after refresh** — closed
  triggers now always resolve the selected item's label (book title, person
  name, shelf name, year); fixes cuid text appearing in the /lending form
  after navigation/refresh.
- **Phase 1 — visual consistency:** light-theme `--accent` unified to the
  design-language accent `#BB4F35` (was a competing `#B56F76`); base radius
  lowered to 12px (§9 family 4/8/12/pill); sidebar active state is now a
  soft accent background + accent text/icon instead of a filled pill;
  mobile bottom navigation shows icon + localized label.

## 3.6.0 — 2026-09-27

### Added

- **Self-approve registrations (`auth.selfApprove`)** — new config.yaml
  `auth.selfApprove` (default `false`). When `true`, every new registration
  is approved automatically — no admin approval step. There is no email
  verification, so addresses are approved as-is. The register screen shows
  "you can log in right away" instead of the approval-pending notice (6
  languages). Only affects new registrations; the /admin approve flow keeps
  working either way.
- **Admin self password reset** — admins can reset their own password from
  the Admin panel (random password, shown once, `mustChangePassword` at
  next login). Other admins remain off-limits; TOTP-protected admins confirm
  with a fresh code in a small dialog; rate-limited 5/5min.

### Changed

- **Barcode scanner opens the rear camera by default**
  (`videoConstraints.facingMode: "environment"`); other cameras remain
  selectable from the scanner UI.

## 3.5.1 — 2026-09-27

### Added

- **User-adjustable "Read N pages" step** — each user can now pick their own
  step in Settings → Reading step (1–1000). Resolution order:
  user setting → admin floor → config.yaml `xp.pagesPerReadEvent` → 20.
  Stored per user in `UserSettings.pagesPerReadEvent` (NULL = follow the
  site-wide value). Applied everywhere the step is used: `/books` CTA and
  cards, author/series/group grids, `logPagesRead`, and Kobo sync progress.
- **Admin reading-step minimum** — new Admin panel card ("Reading Step
  Minimum") stores a site-wide floor in `SiteSettings.minPagesPerReadEvent`
  (singleton row; 0 = off). When set, every user's effective step is lifted
  to at least this value; the Settings card shows a hint with the floor.

### Changed

- **Lending is people-first** — the borrower field on `/lending` and on the
  book detail page is now a dropdown of existing people instead of free
  text. New people are created on `/people` only; `createLending` takes a
  `personId` and no longer auto-creates a person from a typed name (removes
  duplicate/misspelled people). An empty dropdown links to `/people`.
- **`/books` page-log CTA** — the "Read N pages" button moved out of the
  page header into the content flow between the add panel and the list
  toolbar, styled like the neighboring outline action buttons (UI Design
  Language §10/§16, GNOME HIG: discoverability + consistency).

### Migration

- `20260927193000_user_read_step_and_site_min_pages` — adds
  `UserSettings.pagesPerReadEvent` and the `SiteSettings` singleton table.

## 3.5.0 — 2026-09-27

### Added

- **Material You launcher icon support (PWA)** — new `icon-512-monochrome.png`
  rendered from the Symbolic Master (transparent background, artwork scaled to
  ~74% inside the safe zone) and declared in the manifest with
  `purpose: "monochrome"`. The Android launcher (Android 13+; automatic for all
  apps on Android 16 QPR2+) ignores its colors and tints the alpha mask with the
  user's wallpaper-derived system palette — themed icons now match the device
  theme. Regeneration command added to `brand/README.md`. No in-app palette,
  `theme_color` or other assets are affected.

### Fixed

- **Docker build** — the 3.4.0 image failed to build everywhere:
  `ghcr.io/pgaskin/kepubify:v4.0.4` was unpublished upstream, so
  `COPY --from` died at metadata resolution (the last successfully published
  image was 3.3.0). The production stage now fetches the official
  `kepubify-linux-64bit` v4.0.4 binary from the GitHub release in a
  `scratch` stage, pinned by SHA-256
  (`37d7628d…31fc5` — verified by `ADD --checksum` at build time). The
  GitHub Actions `Docker Publish` workflow (triggered by `v*` tags) resumes
  publishing.

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

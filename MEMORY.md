# Bookshelf — Memory Bank

> Last updated: 2026-09-14
> Version: 2.9.6
> Branch: main

---

## 1. Project Definition

Personal library management application. Book adding, lending tracking, reading statistics and Duolingo-style gamification (XP, levels, achievements, leaderboard).

Web rewrite of the original PyQt6 desktop app (`legacy` branch).

**Repo:** https://github.com/farukylmz0550/bookshelf-web

---

## 2. Tech Stack

| Layer | Technology |
|--------|-----------|
| Framework | Next.js 16 (App Router) + TypeScript |
| UI | Tailwind CSS 4, shadcn/ui, lucide-react, Recharts, Noto Serif/Sans/Mono |
| Theme | Fine Porcelain × Burnt Ochre (light) / Ink & Copper (dark) — CSS vars `UI_Design_Language.md` |
| Database | SQLite via Prisma 7 (`better-sqlite3`) |
| Auth | NextAuth v5 (Credentials, JWT, bcrypt) |
| Validation | Zod |
| Formatting | Prettier + ESLint |
| Test | Vitest (unit), Playwright (e2e) |
| i18n | Cookie-based locale, 6 dictionaries |
| PWA | `public/sw.js` + `manifest.json` + `src/app/sw-register.tsx` |
| Consent | GDPR cookie banner `src/components/cookie-consent.tsx` (Essential/Preferences/Analytics) |
| Deploy | Docker (multi-stage), Docker Compose, GHCR |

---

## 3. File Structure

```
bookshelf/
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── books/            # Book list (Card/List), add (ISBN one-click + detailed), filters, Excel
│   │   │   │   ├── books-add-section.tsx  # Arrow → detailed form (60/40 card)
│   │   │   │   ├── book-card.tsx          # Equal cards h-[380px] 60/40 object-contain
│   │   │   │   ├── books-grid.tsx         # 2→3→4 cols + view-mode cookie
│   │   │   │   └── [id]/                  # Book detail, edit, lending, personal
│   │   │   ├── lending/          # Lending list and form
│   │   │   ├── people/           # People directory and history
│   │   │   ├── stats/            # Statistics, goals, charts, streak, heatmap
│   │   │   ├── achievements/     # Achievement badges (grid)
│   │   │   ├── leaderboard/      # XP ranking
│   │   │   ├── profile/          # Edit name, change password
│   │   │   ├── settings/         # Notifications + theme (Sun/Moon SVG) + language + licenses link
│   │   │   ├── more/             # Bottom-nav overflow
│   │   │   └── admin/            # Admin (users, covers) — bottom of sidebar
│   │   ├── actions/              # Server actions (books, lending, people, goals, excel, profile, covers, admin, locale, theme, logout, settings)
│   │   ├── api/                  # API routes (auth, test reset, streak, well-known)
│   │   ├── login/                # Login page
│   │   ├── register/             # Registration page
│   │   └── setup/                # First-time admin setup
│   ├── components/
│   │   ├── ui/                   # shadcn/ui (token-aware)
│   │   ├── sidebar.tsx           # Collapsible sidebar (desktop, cookie sidebar-collapsed)
│   │   ├── bottom-nav.tsx        # Bottom nav (mobile, safe-area)
│   │   ├── cookie-consent.tsx    # GDPR banner (desktop modal / mobile bar)
│   │   ├── theme-dropdown.tsx    # Sun/Moon SVG (Lucide ISC)
│   │   └── install-prompt.tsx    # PWA install
│   ├── lib/
│   │   ├── books/                # Book domain logic + filters + openlibrary
│   │   ├── cookies.ts / cookies-client.ts / cookies-shared.ts # Consent helpers
│   │   ├── db.ts                 # Prisma client singleton
│   │   ├── gamification.ts       # XP, levels, achievements (DB)
│   │   ├── gamification-pure.ts  # Pure functions (Fibonacci, streak)
│   │   ├── goals.ts              # Goal math
│   │   ├── isbn.ts               # ISBN lookup (full metadata)
│   │   ├── person.ts             # Person normalization, trust
│   │   ├── stats.ts              # Monthly finish counts
│   │   ├── streak.ts             # Streak calculation
│   │   └── theme.ts              # Cookie theme (light/dark, Sun/Moon)
│   ├── i18n/                     # Dictionaries (en, tr, es, fr, ru, zh)
│   ├── auth.ts                   # NextAuth config + approval check
│   ├── proxy.ts                  # Proxy (auth + rate limiting)
│   └── types/                    # TypeScript declarations
├── prisma/
│   ├── schema.prisma             # Data model
│   ├── seed.ts                   # Achievement catalog seed (dev)
│   ├── seed.cjs                  # Achievement catalog seed (Docker)
│   └── migrations/               # Database migrations
├── e2e/                          # Playwright E2E tests
├── public/                       # Static files, sw.js, manifest.json
├── UI_Design_Language.md         # Visual language source of truth
├── Architecture_Principles.md    # Architectural boundaries
├── Project_Rules.md              # Project-level rules
├── Dockerfile                    # Multi-stage Docker build
├── docker-compose.yml            # Self-hosting setup
└── vitest.config.ts              # Unit test config
```

---

## 4. Data Model

```
User ──────┬── Book ──────── LendingRecord
           ├── Person ────── LendingRecord
           ├── Goal
           └── UserAchievement ── Achievement
```

| Model | Key Fields |
|-------|------------|
| **User** | email, passwordHash, name, isAdmin, approved, xp, currentStreak, longestStreak, lastActiveDate, streakShieldCount |
| **Book** | isbn, title, author, coverUrl, status, rating, tags, copies, subtitle, publishers, publishDate, publishPlaces, numberOfPages, languages, isbn10/13, subjects, 17 legacy fields |
| **Person** | name (unique per user), auto-created on lending |
| **LendingRecord** | book, borrower, lentAt, returnedAt, denormalized bookTitle, personId |
| **Goal** | yearly, monthly targets per user |
| **Achievement** | key, titleKey, descriptionKey, iconKey (i18n) — 8 achievements (week/month/century streak incl.) |
| **UserAchievement** | user + achievement link with unlock date |
| **DailyActivity / StreakShield / UserSettings / PushSubscription** | streak & notification tracking |

---

## 5. Server Actions

| File | Mutations |
|-------|------------|
| `auth.ts` | register (approved=false) |
| `books.ts` | add (full metadata, one-click ISBN), update, delete, set status, lookupIsbn |
| `lending.ts` | create, return |
| `people.ts` | create, remove |
| `goals.ts` | set yearly/monthly |
| `excel.ts` | export, template, import |
| `goodreads.ts` | importGoodreadsCsv (Goodreads CSV → books: ISBN dedupe, shelf→status/tags, Open Library enrichment, XP+achievements) |
| `profile.ts` | update name, change password |
| `covers.ts` | clear cache (admin) |
| `admin.ts` | approve/reject users, toggle admin, delete users |
| `locale.ts` | switch language (consent-gated) |
| `theme.ts` | toggle theme Sun/Moon SVG (light/dark, consent-gated) |
| `logout.ts` | signOut |
| `settings.ts` | update notifications/streak/weeklyDigest/goalReminders (goalReminders feeds calendar-based goal-progress push) |
| `settings-admin.ts` | updateAppSettings (system-admin only: reading/XP values) |
| `cookies.ts` | setConsentCookie, hasConsent |

Every data-modifying action runs `awardXp()` + `syncAchievements()`. ISBN one-click flow chains `lookupIsbnAction` → `addBook` with all Open Library fields.

---

## 6. Environment Variables

| Variable | Required | Default | Description |
|----------|---------|------------|----------|
| `DATABASE_URL` | Yes | `file:./prisma/dev.db` | SQLite database path |
| `NEXTAUTH_SECRET` | Yes | — | Secret for JWT signing |
| `NEXTAUTH_URL` | No | `http://localhost:3000` | Application URL |
| `APP_PORT` | No | `3000` | Port (used by Docker) |
| `RESET_SECRET` | No | — | Secret for `/api/test/reset` endpoint |
| `ALLOW_REGISTRATION` | No | `true` | Set to `false` to disable public registration |

---

## 7. Docker Setup

```bash
# Pre-built image
docker compose up -d

# Build from source
docker compose up -d --build
```

- Build tools (python3, make, g++) are installed in production stage
- `seed.cjs` runs without tsx in Docker
- Prisma migrations are automatically run by entrypoint

---

## 8. Testing

```bash
npm test              # 190 unit tests (vitest)
npx playwright test   # 38 e2e tests (playwright)
npm run lint          # eslint
npm run format:check  # prettier
```

---

## 9. Important Commit History (Web Rewrite)

| Date | Commit | Description |
|-------|--------|----------|
| 2026-09-12 | `a1ae69b` | `2.9.1` — SPDX license headers on 206 files (GPL-3.0-only: src/179, root configs, e2e specs, prisma schema+seed, scripts w/ shebang exception; CC-BY-NC-ND-4.0: brand masters + icon/logo svgs) + root NOTICE.md license table; metadata only, prepend-only diff; 218 unit + 42 e2e green |
| 2026-09-12 | `ddeed16` | `2.9.0` — **feature-freeze begins (patches only from here on)**: AppSettings fixed singleton id `singleton` (atomic upsert; migration `20260912130000_appsettings_singleton_id` dedupes+pins), logPagesRead optimistic lock (currentPage unchanged incl. NULL, conflict on race, XP only after confirmed write, auto-finish +status guard), finishBookWithXp idempotency (fresh check + 10s TTL claim), createGroup order race transaction; dependency overrides (mysql2 ^3.24.4, deepmerge-ts ^8.0.2, uuid ^11.1.1) → npm audit 0; CHANGELOG.md created; 218 unit (incl. race-safety.test.ts ×8) + 42 e2e green |
| 2026-09-12 | `119fba0` | `2.8.0` — Groups/Shelves: `BookGroup` + `BookGroupMembership` (many-to-many, cascade rules), migration `20260912000000_add_groups`, `src/lib/groups.ts` (pure validation: name ≤60, palette/hex colors `#RRGGBB`, `applyReorder` permutation check), `src/app/actions/groups.ts` (6 ownership-scoped actions: create/rename/delete/reorder/addBookToGroup/removeBookFromGroup, stable error codes), `/groups` manager (dialogs, up/down reorder, palette+hex picker) + `/groups/[id]` detail (existing BooksGrid reuse, empty state), books-page Group filter (AND with tags/status/search), book-card color dots (max 3 + "+n"), book-detail membership chips, sidebar+More nav, 6-lang i18n (31 keys), 210 unit + 42 e2e green |
| 2026-09-11 | `2.7.0` | Annual Reading Summary (Jan 1–7 window, read-event metrics, PNG share card, 9-piece CC0 mood music) + reading rules (page-log button, auto-FINISH at all pages read, re-read +1, early-finish block) + goal lock (once/year) + goal-progress push calendar + AppSettings admin/env values |
| 2026-09-11 | `2.6.0` | Goodreads CSV import — `src/lib/books/goodreads.ts` (RFC 4180 parser, ISBN13-first normalization, shelf→status/tags) + `src/app/actions/goodreads.ts` (20 MiB, 5000-row guard, ISBN dedupe, OL enrichment, revalidatePath) + books UI button + 6-lang i18n |
| 2026-09-09 | `2.3.2` | English-only (hardcoded Turkish → English, i18n synced, locale native names kept), releases titled as "{version}" without v |
| 2026-09-09 | `2.3.1` | Settings-only theme/locale (sidebar/mobile header removed), licenses link in Settings, docs Turkish → English, book card 60/40 readable (h-[380px] object-contain) |
| 2026-09-09 | `2.3.0` | UI Design Language 60/40 card, Noto, Terracotta/Ink-Copper, collapsible sidebar, cookie consent (C), ISBN one-click + detailed form, bulk import removed, high-contrast removed, Sun/Moon SVG |
| 2026-09-08 | `768d827` | GitHub Actions removed, README updated |
| 2026-09-08 | `62ca415` | Docker build + Turbopack compatibility + TS errors fixed |
| 2026-09-07 | `d08b72e` | i18n fixes, CI/CD, admin approval system |
| 2026-09-07 | `d294650` | showOnLeaderboard opt-out added |
| 2026-09-07 | `92b4070` | Security: dangerous NEXTAUTH_SECRET removed from .env.example |
| 2026-09-07 | `df14474` | Security: Security headers added |
| 2026-09-07 | `fba642f` | Security: Conditional seeding (entrypoint) |
| 2026-09-07 | `8f6a3e6` | Security: Cookie httpOnly/secure/sameSite |
| 2026-09-07 | `a95cb3e` | Security: Zod string length limits + coverUrl validation |
| 2026-09-07 | `c76e074` | Security: auth required for lookupIsbnAction |
| 2026-09-07 | `0b16703` | Security: Zod + transaction guard for admin setup |
| 2026-09-07 | `2684f4b` | Security: ALLOW_REGISTRATION env var |
| 2026-09-07 | `a9dd777` | Security: Test reset protected with admin + token |
| 2026-09-04 | `3b530eb` | Docker build workflow (GHCR) added |
| 2026-09-04 | `c44a25d` | README and CONTRIBUTING.md rewritten |
| 2026-09-04 | `282eef1` | Prettier added |
| 2026-09-04 | `3ce6d8a` | Cover cache stats accuracy improved |
| 2026-09-04 | `59d2d6f` | Dockerignore PNG issue fixed |
| 2026-09-04 | `4d675a5` | Orphan Rust crate removed |
| 2026-09-04 | `f314a85` | Unused components and dead code removed |
| 2026-09-04 | `c2303bf` | Hardcoded database paths fixed for portability |
| 2026-09-02 | `9d85a8a` | PWA/TWA support + notifications |
| 2026-09-02 | `a5f0c2c` | GNOME Adwaita design language |
| 2026-09-02 | `a35f651` | Editorial redesign — AI template feel removed |
| 2026-09-01 | `f127944` | Warm & Literary UI redesign + shadcn/ui |
| 2026-09-01 | `e247fe7` | Favicon, error/loading states, profile page, pagination, SEO, rate limiting, unit tests |
| 2026-08-31 | `cce9700` | Playwright e2e test suite + vitest exclude |
| 2026-08-31 | `6e88849` | SQLite + rust core + legacy equiv (books, people, goals, excel, openlibrary, i18n) |

---

## 10. Known Issues and Notes

- **Turbopack + better-sqlite3:** Turbopack bundles better-sqlite3 in client components → `fs` error. Fix: `gamification-pure.ts` with pure functions separated.
- **Docker production stage:** better-sqlite3 compiles with node-gyp, requires python3/make/g++ in production stage.
- **prisma7.config.ts:** `dotenv/config` is devDependency, not available in production → removed, env var used directly.
- **seed.cjs:** TypeScript seed file (`tsx` devDependency) doesn't run in production → plain JS alternative added (`CONTRIBUTING.md` exception: `public/sw.js` + `prisma/seed.cjs`).
- **Proxy (middleware.ts):** In Next.js 16 `middleware.ts` is deprecated → `proxy.ts` is correct convention.
- **Sidebar server actions:** `setLocale.bind`/`setTheme.bind` in Client Component → React #441. Fix: `useTransition` + direct `setLocale()`/`setTheme()` calls, `logoutAction` as separate server action.
- **High Contrast:** Removed as incompatible with `UI_Design_Language.md` (GNOME residue). Theme is now only `light`/`dark` (Sun/Moon SVG, Lucide ISC).
- **Book Card 60/40:** `h-[380px]` `h-[60%]` cover `object-contain p-2` + `h-[40%]` metadata `gap-1 px-3 py-3`, `text-[15px] serif` readable. Bulk import (`importBooksByIsbn`) removed.
- **Cookie Consent:** Server/client split via `src/lib/cookies-shared.ts`; `next/headers` only on server.
- **License file naming:** root-level `LICENSE-{LİSANADI}` convention — `LICENSE-GPLV3`, `LICENSE-CC-BY-NC-ND`, `LICENSE-CC0` (audio renders). Never drop the suffix or rename mid-project.

---

## 10.1 Release Process (Rule)

- After every **comprehensive feature/patch** is completed and the validation set passes (`npm test` · `npm run lint` · `npm run format:check` · `npm run build` · `npx playwright test`), **ASK the user**: "Release alalım mı?"
- **Never commit/push/tag/release without explicit user approval.**
- Upon approval, follow this flow:
  1. Conventional Commit on `main`: `feat|fix: {version} — {short description}`
  2. `git push origin main`
  3. Tag `{version}` (no `v` prefix — 2.4.0+ convention) and push it
  4. Docker image: `gh workflow run docker-publish.yml` (workflow triggers on `v*` tags only; versions without prefix need dispatch; it reads the version from `package.json`) → GHCR `{version}` + `latest`
  5. `gh release create {version} --title "{version}" --notes-file <notes.md>` — notes follow the 2.5.1 template: what changed + **QA** line (tsc/lint/format/unit/e2e/build counts) + Docker line
- Monitor with `gh run list` and `gh release view {version}`.

---

## 11. Original Project (Legacy)

Desktop app written with PyQt6. Located in `legacy` branch.
Both projects continue under GPLv3.

---

## 12. PWA Improvements TODO

### High Priority
- [x] **Camera ISBN barcode scan** — `src/components/barcode-scanner.tsx` (html5-qrcode) wired into `add-book-form.tsx`; scan fills ISBN and auto-runs lookup + add
- [x] **Safe area insets** — `env(safe-area-inset-*)` + `safe-bottom`/`safe-top` (layout, bottom-nav)
- [x] **viewport-fit=cover** — `layout.tsx:27` `viewportFit: "cover"`
- [x] **Bottom navigation bar** — `src/components/bottom-nav.tsx` + `src/components/sidebar.tsx` (Responsive Hybrid Shell)

### Medium Priority
- [x] **Offline precaching** — `sw.js` install precaches `/offline.html`, manifest, icons (cache `bookshelf-v3`)
- [x] **Offline fallback page** — navigations fall back to precached `/offline.html` when offline
- [x] **Web Share API** — `src/components/share-button.tsx` (book detail, mobile)
- [x] **True push notification** — `web-push` + VAPID (`src/lib/push.ts`), `/api/push/subscribe`, `/api/push/streak-remind` (Bearer CRON_SECRET), Docker cron service daily trigger; local timer fallback kept
- [x] **SW update notification** — `sw-register.tsx` `updatefound` → refresh toast
- [x] **Custom install button** — `src/components/install-prompt.tsx` (`BeforeInstallPrompt`)

### Low Priority
- [x] **Background sync** — `src/lib/offline-queue.ts` (localStorage queue) + SW `sync` tag `bookshelf-sync-books`
- [x] **Manifest shortcuts** — Add book / Lending / Stats
- [x] **Manifest screenshots** — `public/screenshots/narrow.png` (720×1280) + `wide.png` (1280×720)
- [x] **Touch gestures** — swipe (status cycle) + long-press (status menu) on book card
- [x] **Haptic feedback** — `src/lib/haptic.ts` (book card, book personal, streak widget)

---

## 13. Tomorrow's TODO — BookShelf UI/Branding Overhaul

> ✅ **PROGRESS — 2026-09-14 (v2.9.6 — page-log UX, streak feedback, page-count backfill):**
> - **Diagnosis (live prod DB):** the page-log button always worked (33 presses recorded, XP + activity rows written). "Streak not increasing" was day-based-streak semantics + no visible feedback; ALL 188 books had `numberOfPages = null` (Goodreads import enriched pages only when OL had them; 3-consecutive-failure abort killed enrichment mid-run).
> - **Button:** imperative label "Read {count} pages"/"{count} sayfa oku"; logs exactly the label's count — `min(pagesPerReadEvent, pagesLeft)` via `logPagesRead(book.id, pagesToLog)` (server param already existed).
> - **Streak in toast:** `recordActivity` returns `{current, longest}`; `logPagesRead` returns `streak` (finish path reads `user.currentStreak`); toast "{count} pages logged · 🔥 {streak}-day streak" (6 langs).
> - **Page-less prompt:** no `numberOfPages` → animated modal (save=updateBook + immediate logPagesRead of min(step, remaining)). Keys `books.pagesPromptTitle/Placeholder/Invalid` + cardDict `save/cancel` (from `dict.facts`) ×6 langs.
> - **Long-press feel:** `useLongPress` gained `onPressStart/onPressEnd`; card scales `scale-[0.97]` while held; menu + modal animate in (`animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200`).
> - **Flat buttons framed:** "Detailed add" toggle (books-add-section) + mobile Share icon-button → standard boxed style.
> - **Page-count backfill:** `backfillPageCounts()` (actions/books.ts) — user's `numberOfPages=null`+`isbn≠null` books via throttled `lookupIsbns`, chunked (≤20/chunk, ≤40/run), fills ONLY numberOfPages, returns {filled, notFound, remaining}; `/admin` §4 PageBackfillCard + `admin.pageBackfill*` ×6 langs.
> - **e2e updated:** annual-summary page-log test now goes through the modal (fill 100 → save → "20 pages logged").
> - **QA:** tsc ✅ lint ✅ (1 pre-existing warning) format ✅ unit 193/193 ✅
>
> ✅ **PROGRESS — 2026-09-11 (session 9 — v2.7.0 Annual Reading Summary + reading system):**
> - **Annual Summary (no "Wrapped" branding anywhere):** `/stats` bottom section, visible ONLY Jan 1 00:00 → Jan 7 end on the **server-local clock** (`isAnnualSummaryWindow`, dev/e2e always open); default year = just-completed year in production (current year in dev). Metrics from **read events**; Recharts + sr-only text fallback; PNG share-card (deterministic canvas, no user data beyond stats).
> - **Reading rules (user-defined):** "Log N pages read" card button on `/books` → `currentPage` +N (default 20, `AppSettings.pagesPerReadEvent`) + streak (`recordActivity`) + page-based XP (`floor(pages/10) × xpPagesPer10`, NO streak multiplier) — does NOT finish the book. Book finishes ONLY when ALL pages are read → automatic FINISHED (+1 `BookReadEvent`, finish XP w/ streak bonus). Early manual finish blocked (`RemainingPages`); page-less books keep manual finishing. "Read again" on FINISHED cards → currentPage=0 + READING; re-completion adds +1.
> - **Goal lock:** yearly+monthly targets confirmed ONCE per year (`confirmGoals`) → locked read-only cards until Jan 1 (server-local); migration marked existing goals as confirmed for the current year. Goal progress counts read events (completions).
> - **Music (CC0):** 9 public-domain pieces rendered ONCE at dev time (`scripts/render-annual-audio.mjs` offline synth → ffmpeg/libmp3lame 96k, ID3 artist=`farukylmz0505`, CC0 comment; `LICENSE-CC0` + `public/audio/annual/README.md`). The APP picks the piece deterministically from goal-progress mood: `<⅓` sad (Chopin Nocturne, Moonlight, Swan Lake) · `⅓–⅔` neutral (Minuet in G, Für Elise) · `⅔–1` happy (Nachtmusik, Rondo alla Turca, Spring) · `>1` celebration (Ode to Joy) — mood pool pick by year hash. Plays once (no loop), lazy single fetch, mute toggle, autoplay "Enable sound" fallback, sw.js runtime-cache + CACHE_NAME v4.
> - **Goal-progress push (calendar):** day 1 = month start + target · day 10/20 = "N books, P% of goal" · last 3 days = remaining books · **silenced once monthly goal reached (rule A)**. `/api/push/goal-progress` (CRON_SECRET) added to the daily docker cron list. Localized templates (percent sign inside the template: TR "%{percent}", EN "{percent}%"); per-user locale synced from the cookie into `UserSettings.locale` (EN fallback).
> - **AppSettings (singleton):** pagesPerReadEvent, xpBookAdded, xpBookFinishedBase, xpPagesPer10, xpLending, xpPerLevelBase — env defaults (`READ_EVENT_PAGES`, `XP_*`), system-admin editable on `/admin` ("Reading Settings"). `gamification-pure` now parametric with legacy defaults; level curve base configurable (derived level → changes retroactively).
> - **Schema (user-driven, single migration `20260911193502_annual_summary_settings_reads`):** Goal.targetYear/confirmedAt (existing goals locked) · BookReadEvent (+backfill of existing FINISHED books) · AppSettings · UserSettings.goalReminders + locale.
> - **QA:** tsc ✅ lint ✅ (1 pre-existing warning) format ✅ unit 190/190 ✅ e2e 38/38 ✅ prod build ✅ ffprobe assets ✅
>
> ✅ **PROGRESS — 2026-09-11 (session 8 — v2.6.0 Goodreads CSV import):**
> - **Parser:** `src/lib/books/goodreads.ts` — hand-rolled RFC 4180 `parseCsvText` (quoted fields, escaped `""`, commas in quotes, CRLF, BOM, UTF-8 string input — no naive `split(",")`, no new dependency); header matching case-insensitive; Zod per-row validation; formula-wrapped ISBNs (`="…"`) + Excel float remnants cleaned; valid ISBN13 preferred over ISBN-10, invalid never fabricated; `Date Read` parsed as UTC; shelves → unambiguous status (read > currently-reading > to-read) + custom shelves as tags; one bad row never aborts the import. Guards: 20 MiB (`GOODREADS_CSV_MAX_BYTES`), 5000 rows, ≤10 error messages.
> - **Action:** `src/app/actions/goodreads.ts` `importGoodreadsCsv(base64)` — `requireUserId()`, in-memory duplicate check derived only from the current user's books (ISBN match; title|author exact match only for ISBN-less rows — no fuzzy guessing), Open Library enrichment via existing `lookupIsbns` (deduped per unique ISBN, failures swallowed → `lookupFailed`), `createMany` + row-by-row fallback, `awardXp` + `syncAchievements`, **`revalidatePath("/books")`** (e2e found the grid stayed stale without it), machine-readable error codes (`invalidCsv|fileTooLarge|tooManyRows|noValidBooks`).
> - **UI:** "Import from Goodreads" (BookOpen icon) next to Excel import in `excel-actions.tsx`; loading state; summary line (imported / duplicates skipped / invalid rows / lookup failed) + first error detail; client maps error codes to i18n strings.
> - **i18n:** `goodreads` block in all 6 dictionaries + `tooManyRows` key added.
> - **Tests:** `src/lib/books/goodreads.test.ts` (parser A–N, shelves, date, rating — union-narrowed with an `expectRows` helper to keep `tsc` happy) → 137 unit total; `e2e/goodreads-import.spec.ts` (valid import + summary, duplicate skip, invalid CSV i18n message, Excel regression) → 32 e2e total. e2e uses an `importCsv` helper with response-wait + retry (hydration race: a change event landing pre-hydration is lost).
> - **QA:** tsc ✅ lint ✅ (1 pre-existing warning) format ✅ unit 137/137 ✅ e2e 32/32 ✅ prod build ✅ — released as `2.6.0`.
>
> ✅ **PROGRESS — 2026-09-11 (session 7 — v2.5.1 cleanup patch):**
> - **README:** AI banner is now a single centered heading (`<h2 align="center">`) — no GitHub alert, no emoji (user's final preference).
> - **Admin guard atomics:** `toggleAdmin`/`deleteUser` last-admin count + update/delete wrapped in `db.$transaction` (same interactive-transaction pattern as lending/streak) — two concurrent requests can no longer both pass the check.
> - **cookie-consent view split (SRP):** desktop modal (`hidden md:flex`) and mobile banner (`md:hidden`) are fully independent render trees → `cookie-consent-desktop.tsx` + `cookie-consent-mobile.tsx` + thin `cookie-consent.tsx` wrapper (single `useCookieConsent()` call, state passed as prop). Import surface unchanged.
> - **SRP test on the other 4 files (no split — single reason to change each):** `books-grid.tsx` (188) one cohesive filter+views composition; `sidebar.tsx` (157) one nav shell, cookie/NavLink logic already extracted; `book-card.tsx` (172) card + its long-press menu are one interaction, status logic already in `lib/status-cycle.ts`; `book-personal.tsx` (168) field logic already in `useEditableField`/`useSaver`. No forced splits.
> - **QA:** tsc ✅ lint ✅ format ✅ unit 115/115 ✅ e2e 28/28 ✅ build ✅
>
> ✅ **PROGRESS — 2026-09-11 (session 6 — v2.5.0 lending due dates + overdue reminders):**
> - **Schema:** `LendingRecord.dueDate DateTime?` (nullable, no index) — migration `20260911140705_add_lending_due_date` applied to dev.db; existing rows untouched. Docker entrypoint applies it automatically.
> - **Lending action:** `createLending(bookId, borrowerName, dueDate?: string | null)` — authoritative server-side Zod validation via `parseDueDate` (`src/lib/lending-due.ts`): date-only input normalized to end-of-UTC-day, must be strictly in the future (today counts as due, not overdue); no due date → `null`. Transaction + person/copy guards preserved.
> - **UI (both lending forms):** optional native `<input type="date">` (`min` = tomorrow) in `lending-form.tsx` AND `book-lending.tsx` (book detail); `lending-row.tsx` shows a `secondary` "Due <date>" badge for active due dates and an `error-soft` "Overdue · <date>" badge (destructive return button) when `dueDate < now && returnedAt = null`; null dueDate shows nothing. New i18n keys in 6 languages: `lending.dueDate/dueDateOptional/overdues/dueLabel` + `bookLending.dueDate`.
> - **Overdue push:** `sendOverdueReminders()` in `lib/push.ts` — single query `dueDate < now && returnedAt: null`, ownership derived from `book.userId`; one grouped notification per user per run (≤3 titles + "+N more", `tag: overdue-remind`, respects notificationsEnabled). New endpoint `/api/push/overdue-remind` (same CRON_SECRET pattern: 503 unconfigured / 401 wrong secret). Docker cron now hits both endpoints daily (same container, no second scheduler).
> - **Dedup limitation (by design):** no notification-history table exists in the architecture; grouping + daily cron cadence bound the frequency to max 1 notification/user/day while overdue persists. No extra table added.
> - **Return flow unchanged:** `returnedAt != null` automatically removes a record from the overdue set — no cleanup logic added.
> - **Tests:** new `lending-due.test.ts` (11 tests: A–D validator, F–G isOverdue, J grouping) → 115 unit total; new `e2e/lending-overdue.spec.ts` (UI badge flow + 401/503 endpoint guards + streak endpoint co-existence) → 28 e2e total. tsc ✅ lint ✅ format ✅ build ✅
>
> ✅ **PROGRESS — 2026-09-11 (session 5 — PWA reliability patch 2.4.2):**
> - **manifest.json:** `theme_color` `#3584e4` (obsolete GNOME blue) → `#A25F4C`; `background_color` `#000000` → `#E5D9D4`; icons split: `icon-192` (any) + `icon-512` (any) + `icon-512-maskable.png` (maskable) — `"any maskable"` combined purpose removed.
> - **Maskable icon:** `public/icon-512-maskable.png` generated from `Bookshelf — Color Master.svg` (artwork ~74% on `#E5D9D4`, ~13% padding per side, inside the central 80% safe zone). Added to `brand/icons/` + regeneration commands in `brand/README.md` + `sw.js` precache list.
> - **Timer-based notification scheduling removed (PWA-only):** sw.js `scheduleNotifications()` + `MESSAGES`/`randomMessage` + `checkStreak()` + hourly `setInterval` + `schedule-notifications`/`check-streak`/dead `test-notification` message branches deleted; `activate` call removed. sw-register.tsx: both `setInterval` blocks + `postMessage` calls removed (SW registration, updatefound toast, permission request and `subscribeToPush` kept). notification-perm.tsx: postMessage removed (button only requests permission). Remaining setInterval/setTimeout occurrences are unrelated legitimate uses (openlibrary retry/abort, touch-gestures, share-button, cookie-consent, excel URL revoke, reset retry).
> - **Server-side scheduling untouched:** docker-compose cron → `/api/push/streak-remind` (CRON_SECRET) → VAPID Web Push remains the only scheduled notification mechanism.
> - **PWA validation:** manifest 200 · theme/background/icon purposes verified · all icons + sw.js 200 · SW still has push/notificationclick handlers · SW is timer-free. QA: tsc ✅ lint ✅ format ✅ unit 104/104 ✅ e2e 25/25 ✅ build ✅
>
> ✅ **PROGRESS — 2026-09-11 (session 4 — security & refactor patch):**
> - **Security:** `src/lib/rate-limit.ts` — shared in-memory limiter singleton (per-runtime Map, documented). Login brute-force throttle in `auth.ts` authorize() (10/5min per IP, counter reset on success, matcher still excludes `api/auth` — db/bcrypt unavailable in middleware runtime). Register + setup actions throttled (5/min). Throttles active only in production (`throttlingEnabled()`), so dev/e2e are unaffected. next-auth pinned to exact `5.0.0-beta.32` — **upgrade debt: bump when v5 stable ships**.
> - **Race fixes:** lending create wrapped in `$transaction` (copy-guard atomic); `setBookStatus` uses conditional `updateMany` (status `{ not: status }`) so FINISHED XP awards once; `useStreakShield` moves `dailyActivity.create` inside the transaction (XP rollback safe); last-admin guard in `toggleAdmin`/`deleteUser`.
> - **Streak timezone:** all day boundaries moved to UTC via `startOfUtcDay()` in `lib/streak.ts` (+ `actions/streak.ts`). One-time continuity risk for existing local-midnight records — noted in release notes. This fixes server-TZ inconsistency, NOT per-user local days (accepted trade-off).
> - **License:** `package.json` `"license": "GPL-3.0-only"`; `brand/LICENSE` (CC BY-NC-ND 4.0 notice) added.
> - **Refactor (behavior-preserving):** cookie-consent → `lib/use-cookie-consent.ts` hook + `components/pref-row.tsx`; `DetailedAddForm` → `books/detailed-add-form.tsx`; add-book-form logic → `lib/books/use-add-book-form.tsx` hook; view-mode cookie helpers → `lib/books/view-mode.ts`; sidebar → `lib/sidebar-cookie.ts` + `components/nav-link.tsx` + `lib/nav.ts`; settings → `components/settings/{notification-settings,appearance-settings,toggle-row}`; book-card status cycling → `lib/books/status-cycle.ts` (+4 unit tests); book-personal repeats → `lib/use-editable-field.ts` (`useEditableField` + `useSaver`).
> - **Dev overlay:** Next.js dev tools button hidden (`devIndicators: false`), duplicate React keys fixed (streak-widget `key={i}`), `data-scroll-behavior="smooth"` added — console now clean (0 issues).
> - **Admin consolidation:** single scrollable `/admin` page (User Management + Cover Cache); `/admin/users` + `/admin/covers` redirect to `/admin`; sidebar + More show a single Admin link; `adminLabel` used for nav; new `common.users` key in 6 dictionaries.
> - **QA:** tsc ✅ · lint ✅ (1 pre-existing warning) · format ✅ · unit 104/104 ✅ · e2e 25/25 ✅ · prod build ✅ · console 0 issues + devtools badge absent ✅
>
> ✅ **PROGRESS — 2026-09-11 (session 3 — release published):**
> - Release notes moved out of README → GitHub Releases page (source of truth: releases URL)
> - README: AI warning banner as a centered GitHub `[!WARNING]` alert at the very top; License section now links the two master SVG files directly
> - e2e fixture "Ayse Yilmaz" (ASCII-only)
> - GitHub Releases: `2.4.0` created with English notes; legacy Turkish bodies of `v2.3.1` and `v2.3.0` rewritten in English
> - Tag `2.4.0` re-pointed to the release commit; Docker image rebuilt and pushed (`ghcr.io/farukylmz0550/bookshelf:2.4.0` + `:latest`)
> - Release notes no longer live in README — future releases: write notes directly on the GitHub Releases page
>
> ✅ **PROGRESS — 2026-09-11 (session 2 — release prep):**
> - **§3 Brand Set:** added `brand/` directory — master SVGs (Color + Symbolic), `brand/icons/` (all generated icons), `brand/README.md` (usage rules, regeneration commands, CC BY-NC-ND note)
> - **§20 README / Release:** package.json + badge → **2.4.0**; README: title/brand `Book Shelf`, Brand + Paper Material rows in Features, Design section updated, License section brand names + anchor fixed, **Release Notes 2.4.0** added; 12 e2e screenshots regenerated with the new UI (`manual-gui.spec.ts` resets the DB → dev.db now has `manual@bookshelf.test` admin + 2 books, previous admin data replaced by the e2e flow — that is the project's e2e design)
> - **§21 Final User Testing (automated):** `manual-gui.spec` full flow (setup → books → lending → people → stats → achievements → leaderboard → admin → i18n/theme) ✅ + `verify-admin-gui` 25/25 ✅ + manual mobile-view QA ✅. **On-device PWA installation test must be done manually.**
> - **Remaining (single item):** real mobile device / PWA installation trial — manual user test.
>
> ✅ **PROGRESS — 2026-09-11 (session 1):**
> - **§3 Logo & Branding (mostly complete):** All assets rendered from `Bookshelf — Color Master.svg` (Librsvg render): `icon.svg`, `logo.svg` (identical master copies), `icon-192/512.png`, `icon.png`, `apple-touch-icon.png`, `favicon.ico` (16/32/48). 7 in-code img references switched to `/logo.svg`. `proxy.ts` PUBLIC_PATHS updated. Brand name `Book Shelf` everywhere user-facing (src ×12, i18n ×6 languages, manifest.json, sw.js notifications, offline.html). Technical names kept (`bookshelf` package, `Bookshelf/1.0` User-Agent, cache/tag names). Trademark symbols removed from code (README exempt).
> - **§1 Paper Material (removed in 2.9.3):** the grain overlay, paper wash and `.paper-surface` treatment were removed from `globals.css` and all components; surfaces now use flat tokens + borders only.
> - **§14 Visual Cleanup (done):** All off-token colors removed (neutral/gray/white/green/amber/blue/orange/red → design tokens). Affected: book-facts, book-lending, book-personal, book detail page, loading.tsx ×4, user-table (amber badge → warning-soft), streak-widget (orange/amber → primary/warning), activity-heatmap (green scale → success alphas), profile-form, share-button.
> - **§18 i18n (partial):** New keys added in 6 languages (books.cover/rating/detailedAdd/addDetailed/orWithAllFields). Hardcoded Turkish strings translated to English or wired to the dictionary: books-grid list headers, books-add-section ×3, setup-server, cookie-consent fallback, add-book-form offline toast, push.ts streak notification, offline.html, activity-heatmap (Pzt→Mon, Az/Çok→Less/More, locale-independent date — hydration fix), streak-widget (Pzt→M/T/W..., En uzun→Longest, Streak Koruma→Use streak shield).
> - **§19 Technical QA (done):** tsc ✅ · lint ✅ (1 pre-existing warning: setup-server no-location-assign) · format:check ✅ · unit 97/97 ✅ · e2e 25/25 ✅ · production build ✅ · console errors clean ✅
> - **Remaining:** Brand Set folder + README (§3), README screenshots/release notes (§20), final user testing (§21), per-page fine-tuning (§4–10 hover/selected/state visuals), responsive + a11y detail sweep (§12–13).
>
> ⚠️ **LOGO SOURCES:** `brand/Bookshelf — Color Master.svg` and `brand/Bookshelf — Symbolic Master.svg` (single source of truth — root copies removed in 2.10.x).
> **ALL** assets, including the favicon, will be generated from these two master SVGs:
> **Color Master** → colored icons (`icon.svg`, `logo.svg`, `icon-192/512.png`, `apple-touch-icon.png`, `favicon.ico`)
> **Symbolic Master** → semantic/monochrome usage.
> Each item in red = mandatory/important work.


### 2. Typography
- <font color="red">**- [ ] Complete Noto Serif usage**</font>
- <font color="red">**- [ ] Complete Noto Sans usage**</font>
- <font color="red">**- [ ] Check page titles**</font>
- <font color="red">**- [ ] Check subtitles**</font>
- <font color="red">**- [ ] Check navigation text**</font>
- <font color="red">**- [ ] Check button text**</font>
- <font color="red">**- [ ] Check form labels**</font>
- <font color="red">**- [ ] Check book titles**</font>
- <font color="red">**- [ ] Check metadata text**</font>
- <font color="red">**- [ ] Adjust font weights for readability**</font>
- <font color="red">**- [ ] Strengthen text that appears too thin**</font>

### 3. Logo & Branding
- <font color="red">**- [ ] Integrate the new BookShelf logo into the application — kaynak: `Bookshelf — Color Master.svg` / `Bookshelf — Symbolic Master.svg`**</font>
- <font color="red">**- [ ] Remove all old logo usage**</font>
- <font color="red">**- [ ] Update the sidebar logo**</font>
- <font color="red">**- [ ] Replace the favicon with the 32×32 version**</font>
- <font color="red">**- [ ] Prepare the 512×512 launcher icon**</font>
- <font color="red">**- [ ] Preserve the 1024×1024 master logo**</font>
- <font color="red">**- [ ] Check logo usage in the Dark theme**</font>
- <font color="red">**- [ ] Check logo proportions and spacing**</font>
- <font color="red">**- [ ] Integrate the Brand Set into the project**</font>
- <font color="red">**- [ ] Add the Brand Set README**</font>
- <font color="red">**- [ ] Display `BookShelf` for every user-facing brand reference**</font>
- <font color="red">**- [ ] Do not use trademark symbols in technical names**</font>
- <font color="red">**- [ ] Do not use trademark symbols in file names, routes, variables, functions, or other code identifiers**</font>

### 4. Books Page
- <font color="red">**- [ ] Fully adapt book cards to the design language**</font>
- <font color="red">**- [ ] Verify that all cards have identical dimensions**</font>
- <font color="red">**- [ ] Refine the cover / title / metadata hierarchy**</font>
- <font color="red">**- [ ] Refine the hover state**</font>
- <font color="red">**- [ ] Refine the selected state**</font>
- <font color="red">**- [ ] Check card behavior on small screens**</font>
- <font color="red">**- [ ] Adapt the search area to the design language**</font>
- <font color="red">**- [ ] Adapt the filter area to the design language**</font>
- <font color="red">**- [ ] Check Card / List view**</font>
- <font color="red">**- [ ] Adapt the empty state to the design language**</font>
- <font color="red">**- [ ] Test very long book titles**</font>
- <font color="red">**- [ ] Test the grid with a large number of books**</font>

### 5. Book Add / Edit
- <font color="red">**- [ ] Redesign the book-add panel within the design language**</font>
- <font color="red">**- [ ] Refine form headings**</font>
- <font color="red">**- [ ] Check label and input weights**</font>
- <font color="red">**- [ ] Check the ISBN field**</font>
- <font color="red">**- [ ] Clarify the primary action**</font>
- <font color="red">**- [ ] Simplify secondary actions**</font>
- <font color="red">**- [ ] Check validation states**</font>
- <font color="red">**- [ ] Check error states**</font>
- <font color="red">**- [ ] Check loading states**</font>
- <font color="red">**- [ ] Check mobile form behavior**</font>

### 6. Lending
- <font color="red">**- [ ] Adapt the Lending page to the design language**</font>
- <font color="red">**- [ ] Check the lending workflow**</font>
- <font color="red">**- [ ] Check the return workflow**</font>
- <font color="red">**- [ ] Check borrower / person presentation**</font>
- <font color="red">**- [ ] Check status indicators**</font>
- <font color="red">**- [ ] Check mobile layout**</font>

### 7. People
- <font color="red">**- [ ] Adapt the People page to the design language**</font>
- <font color="red">**- [ ] Check person cards / lists**</font>
- <font color="red">**- [ ] Check trust score presentation**</font>
- <font color="red">**- [ ] Check lending history presentation**</font>
- <font color="red">**- [ ] Check the empty state**</font>

### 8. Statistics
- <font color="red">**- [ ] Adapt the Statistics page to the design language**</font>
- <font color="red">**- [ ] Check chart surfaces**</font>
- <font color="red">**- [ ] Check the streak widget**</font>
- <font color="red">**- [ ] Check the heatmap**</font>
- <font color="red">**- [ ] Check goal progress presentation**</font>
- <font color="red">**- [ ] Check color and contrast consistency in charts**</font>

### 9. Gamification
- <font color="red">**- [ ] Adapt the Achievements page to the design language**</font>
- <font color="red">**- [ ] Check XP / level presentation**</font>
- <font color="red">**- [ ] Check achievement cards**</font>
- <font color="red">**- [ ] Check the leaderboard**</font>
- <font color="red">**- [ ] Check goal screens**</font>
- <font color="red">**- [ ] Make sure gamification components do not look overly playful**</font>

### 10. Profile / Settings / Admin / More
- <font color="red">**- [ ] Adapt the Profile page to the design language**</font>
- <font color="red">**- [ ] Adapt the Settings page to the design language**</font>
- <font color="red">**- [ ] Adapt the Admin page to the design language**</font>
- <font color="red">**- [ ] Check the More page**</font>
- <font color="red">**- [ ] Check user management screens**</font>
- <font color="red">**- [ ] Check theme selection**</font>
- <font color="red">**- [ ] Check language selection**</font>
- <font color="red">**- [ ] Check cookie / consent areas**</font>

### 11. Shared UI Components
- <font color="red">**- [ ] Standardize button styles**</font>
- <font color="red">**- [ ] Standardize input styles**</font>
- <font color="red">**- [ ] Check select / dropdown styles**</font>
- <font color="red">**- [ ] Standardize dialog / modal styles**</font>
- <font color="red">**- [ ] Standardize badge / status styles**</font>
- <font color="red">**- [ ] Check tooltip usage**</font>
- <font color="red">**- [ ] Check table styles**</font>
- <font color="red">**- [ ] Standardize empty / loading / error states**</font>
- <font color="red">**- [ ] Check icon consistency**</font>
- <font color="red">**- [ ] Standardize border radius usage**</font>
- <font color="red">**- [ ] Standardize shadow usage**</font>

### 12. Responsive
- <font color="red">**- [ ] Check desktop layout**</font>
- <font color="red">**- [ ] Check desktop with collapsed sidebar**</font>
- <font color="red">**- [ ] Check landscape tablet**</font>
- <font color="red">**- [ ] Check portrait tablet**</font>
- <font color="red">**- [ ] Check mobile**</font>
- <font color="red">**- [ ] Check mobile bottom navigation**</font>
- <font color="red">**- [ ] Check safe-area behavior**</font>
- <font color="red">**- [ ] Test long titles**</font>
- <font color="red">**- [ ] Test long usernames**</font>
- <font color="red">**- [ ] Check overflow and clipping on narrow screens**</font>
- <font color="red">**- [ ] Test landscape / portrait transitions**</font>

### 13. Accessibility
- <font color="red">**- [ ] Check text contrast**</font>
- <font color="red">**- [ ] Check focus states**</font>
- <font color="red">**- [ ] Check keyboard navigation**</font>
- <font color="red">**- [ ] Check touch target sizes**</font>
- <font color="red">**- [ ] Verify that color is not the only indicator of state**</font>
- <font color="red">**- [ ] Check reduced-motion behavior**</font>

### 14. Visual Cleanup
- <font color="red">**- [ ] Remove old colors**</font>
- <font color="red">**- [ ] Remove old component styles**</font>
- <font color="red">**- [ ] Remove outdated border-radius usage**</font>
- <font color="red">**- [ ] Remove outdated shadow usage**</font>
- <font color="red">**- [ ] Remove unnecessary gradients**</font>
- <font color="red">**- [ ] Remove unnecessary blur / glassmorphism**</font>
- <font color="red">**- [ ] Remove unnecessary decorative elements**</font>
- <font color="red">**- [ ] Remove outdated icon styles**</font>
- <font color="red">**- [ ] Fix visual inconsistencies between pages**</font>
- <font color="red">**- [ ] Remove unused styles and assets**</font>

### 15. Functional Checks
- <font color="red">**- [ ] Add a book**</font>
- <font color="red">**- [ ] Edit a book**</font>
- <font color="red">**- [ ] Delete a book**</font>
- <font color="red">**- [ ] Lend a book**</font>
- <font color="red">**- [ ] Return a book**</font>
- <font color="red">**- [ ] Search**</font>
- <font color="red">**- [ ] Filter**</font>
- <font color="red">**- [ ] Statistics**</font>
- <font color="red">**- [ ] Achievements**</font>
- <font color="red">**- [ ] Leaderboard**</font>
- <font color="red">**- [ ] User actions**</font>
- <font color="red">**- [ ] Settings**</font>
- <font color="red">**- [ ] Authentication flow**</font>
- <font color="red">**- [ ] Change language**</font>
- <font color="red">**- [ ] Switch Light / Dark theme**</font>

### 16. PWA / Asset Checks
- <font color="red">**- [ ] Update the icons referenced by the PWA manifest**</font>
- <font color="red">**- [ ] Check favicon usage**</font>
- <font color="red">**- [ ] Check the Apple touch icon**</font>
- <font color="red">**- [ ] Check the 192×192 icon**</font>
- <font color="red">**- [ ] Check the 512×512 icon**</font>
- <font color="red">**- [ ] Check the PWA install prompt**</font>
- <font color="red">**- [ ] Check service-worker asset caching**</font>
- <font color="red">**- [ ] Make sure old logo assets are no longer served from cache**</font>

### 17. Docker / Self-hosted
- <font color="red">**- [ ] Verify that branding changes are included in Docker builds**</font>
- <font color="red">**- [ ] Verify that public assets are included in production builds**</font>
- <font color="red">**- [ ] Check `APP_PORT` behavior**</font>
- <font color="red">**- [ ] Check the default port 1024 setup**</font>
- <font color="red">**- [ ] Perform a clean Docker installation**</font>
- <font color="red">**- [ ] Test the initial `/setup` flow**</font>
- <font color="red">**- [ ] Test the `/login` flow**</font>
- <font color="red">**- [ ] Test the admin approval flow**</font>

### 18. Internationalization
- <font color="red">**- [ ] Complete new UI text in all 6 languages**</font>
- <font color="red">**- [ ] Check `EN / TR / ES / FR / RU / ZH` dictionaries**</font>
- <font color="red">**- [ ] Verify `BookShelf` branding across all user-facing languages**</font>
- <font color="red">**- [ ] Test long translations for overflow**</font>
- <font color="red">**- [ ] Find and remove missing translation keys**</font>

### 19. Technical QA
- <font color="red">**- [ ] Run `npm test`**</font>
- <font color="red">**- [ ] Run `npx playwright test`**</font>
- <font color="red">**- [ ] Run `npm run lint`**</font>
- <font color="red">**- [ ] Run `npm run format:check`**</font>
- <font color="red">**- [ ] Run a production build**</font>
- <font color="red">**- [ ] Check console errors**</font>
- <font color="red">**- [ ] Check console warnings**</font>
- <font color="red">**- [ ] Check visual regressions**</font>
- <font color="red">**- [ ] Check mobile regressions**</font>
- <font color="red">**- [ ] Check authentication regressions**</font>
- <font color="red">**- [ ] Check data mutation regressions**</font>

### 20. README / Release
- <font color="red">**- [ ] Update README screenshots with the new UI**</font>
- <font color="red">**- [ ] Update the design section**</font>
- <font color="red">**- [ ] Update logo references**</font>
- <font color="red">**- [ ] Check `BookShelf` usage**</font>
- <font color="red">**- [ ] Check the GPLv3 / CC BY-NC-ND separation**</font>
- <font color="red">**- [ ] Add the Brand Set reference**</font>
- <font color="red">**- [ ] Verify that Quick Start instructions are still correct**</font>
- <font color="red">**- [ ] Prepare release notes**</font>

### 21. Final User Testing
- <font color="red">**- [ ] Perform a clean Docker installation**</font>
- <font color="red">**- [ ] Create an admin account**</font>
- <font color="red">**- [ ] Register a user**</font>
- <font color="red">**- [ ] Test the approval flow**</font>
- <font color="red">**- [ ] Add a book**</font>
- <font color="red">**- [ ] Add a book using ISBN**</font>
- <font color="red">**- [ ] Edit a book**</font>
- <font color="red">**- [ ] Delete a book**</font>
- <font color="red">**- [ ] Lend a book**</font>
- <font color="red">**- [ ] Return a book**</font>
- <font color="red">**- [ ] Search**</font>
- <font color="red">**- [ ] Filter**</font>
- <font color="red">**- [ ] Check statistics**</font>
- <font color="red">**- [ ] Unlock an achievement**</font>
- <font color="red">**- [ ] Check the leaderboard**</font>
- <font color="red">**- [ ] Create a goal**</font>
- <font color="red">**- [ ] Update the profile**</font>
- <font color="red">**- [ ] Change the language**</font>
- <font color="red">**- [ ] Change the theme**</font>
- <font color="red">**- [ ] Use the application from mobile from start to finish**</font>
- <font color="red">**- [ ] Test PWA installation**</font>
- <font color="red">**- [ ] Restart the application**</font>
- <font color="red">**- [ ] Verify that data remains intact**</font>

### 22. Final Review
- <font color="red">**- [ ] Verify full compliance with `UI_Design_Language.md`**</font>
- <font color="red">**- [ ] Verify full compliance with `Project_Rules.md`**</font>
- <font color="red">**- [ ] Verify full compliance with `Architecture_Principles.md`**</font>
- <font color="red">**- [ ] Verify the new logo is used everywhere — kaynak: `Bookshelf — Color Master.svg` + `Bookshelf — Symbolic Master.svg`, favicon dahil**</font>
- <font color="red">**- [ ] Verify all user-facing brand references use `BookShelf`**</font>
- <font color="red">**- [ ] Verify no technical identifier contains trademark symbols**</font>
- <font color="red">**- [ ] Verify typography is sufficiently strong and readable**</font>
- <font color="red">**- [ ] Verify book cards are consistent**</font>
- <font color="red">**- [ ] Verify Light theme**</font>
- <font color="red">**- [ ] Verify Dark theme**</font>
- <font color="red">**- [ ] Verify responsive behavior**</font>
- <font color="red">**- [ ] Verify PWA assets**</font>
- <font color="red">**- [ ] Verify Docker installation**</font>
- <font color="red">**- [ ] Verify there are no known bugs**</font>
- <font color="red">**- [ ] Confirm the project is ready for release**</font>

---

*This file provides project context for AI assistants. Should be updated regularly.*

<h2 align="center">This Project Is Made Entirely With AI!</h2>

<div align="center">

<img src="public/icon.svg" width="80" height="80" alt="Book Shelf" />

# Book Shelf

**Your warm, calm, timeless personal library.**

*Fine Porcelain × Burnt Ochre · Ink & Copper · Noto Serif/Sans · 60/40 physical cards*

[![Version](https://img.shields.io/badge/version-2.9.3-EAD6D0?style=flat-square&labelColor=2B2727&color=BB4F35)](https://github.com/farukylmz0550/bookshelf-web/releases)
[![Docker](https://img.shields.io/badge/docker-ghcr.io%2Fbookshelf-272A29?style=flat-square&logo=docker&labelColor=1D2020&color=C17A5E)](https://ghcr.io/farukylmz0550/bookshelf)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=nextdotjs)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

> **Feature-freeze:** 2.9.0 and onward are patch releases only (bugfix / security / performance — no behavior, schema or feature changes). See [`CHANGELOG.md`](CHANGELOG.md).

*Self-hosted · Private · No tracking · Your books, your data.*

[Features](#features) · [Screenshots](#screenshots) · [Quick Start](#quick-start) · [Tech Stack](#tech-stack) · [Design](#design)

</div>

---

> **Book Shelf** — Personal digital library experience. Track your books, lending history, goals and stats in a **warm, calm, timeless** interface. With Duolingo-style gamification.

---

## ✨ Features

| | Capability |
|---|---|
| 📚 **Library** | One-click ISBN (Open Library, full metadata: publishers, dates, languages, subjects, ISBN10/13) + detailed manual form (arrow → 14 fields) · Card/List toggle · Excel import/export |
| 🎴 **Cards** | Equal `h-[380px]` **60% cover / 40% meta** · `object-contain` · 12px radius · `2→3→4` responsive grid |
| 🗂️ **Groups** | Personal shelves — create/rename/delete/reorder, optional color · many-to-many books · dedicated `/groups/[id]` grid view · main-page group filter (AND with tags/status/search) |
| 🤝 **Lending** | Lend / return, copy-aware, auto Person creation |
| 👥 **People** | Trust scores + lending history |
| 📊 **Stats** | Total/finished/reading, avg days, monthly chart, streak widget, heatmap |
| 🎮 **Gamification** | XP +5 add / +50 finish / +5 lend (+page & streak bonus) · Fibonacci level · 8 achievements |
| 🏆 **Leaderboard** | Top ranking, opt-out |
| 🎯 **Goals** | Yearly / monthly targets |
| 👤 **Profile** | Name, password, XP, join date |
| 🌍 **i18n** | 6 languages (EN/TR/ES/FR/RU/ZH) — cookie, `src/i18n/dictionaries` |
| 🌓 **Theme** | Light ` #FAF0E1 / #BB4F35` · Dark ` #1D2020 / #C17A5E` · Noto · Sun/Moon SVG · Settings-only |
| 🍪 **Consent** | GDPR banner — desktop modal + mobile bar (Essential/Preferences/Analytics) |
| 🖥️ **Shell** | Collapsible sidebar (desktop, `sidebar-collapsed` cookie) + bottom nav (mobile) · `viewport-fit=cover` · safe-area |
| 📦 **PWA** | `manifest.json` shortcuts · `sw.js` · install prompt |
| 🔐 **Admin** | Approve/reject, promote/demote, delete users + cover cache (bottom of sidebar) · admins cannot act on their own account |
| 🎴 **Brand** | `brand/` set — Color + Symbolic masters, all icons rendered from the Color Master |
| 🐳 **Docker** | `ghcr.io/farukylmz0550/bookshelf` — one command |

---

## 📸 Screenshots

<div align="center">

| Books — Card & List | Stats — Level & Goals | Leaderboard |
|---|---|---|
| <img src="e2e/screenshots/01-setup-login.png" width="320" style="border-radius:12px; border:1px solid #DED8D2" /> | <img src="e2e/screenshots/08-stats.png" width="320" style="border-radius:12px; border:1px solid #DED8D2" /> | <img src="e2e/screenshots/10-leaderboard.png" width="320" style="border-radius:12px; border:1px solid #DED8D2" /> |
| *60/40 cards · 2→4 cols* | *Monthly chart · Streak* | *Top ranking* |

*Full flow: `npx playwright test e2e/manual-gui.spec.ts` → `e2e/screenshots/` (12 images)*

</div>

---

## 🎨 Design

**Character:** Classic · Academic · Cozy Library · Warm · Timeless — *"This is my library, and I like being here."*

| Theme | Background | Surface | Elevated | Accent | Text |
|---|---|---|---|---|---|
| **Light** Fine Porcelain × Burnt Ochre | `#FAF0E1` | `#F2EDEC` | `#FFFFFF` | `#BB4F35` | `#2B2727` |
| **Dark** Ink & Copper | `#1D2020` | `#272A29` | `#333735` | `#C17A5E` | `#F2EEE8` |

- **Typography:** Noto Serif (titles) · Noto Sans (ui) · Noto Mono (technical)
- **Cards:** Identical geometry, `rounded-[12px]`, subtle `border-strong` + `shadow-sm` on hover — no drag-drop
- **Brand:** `brand/` — Color & Symbolic masters + all generated icons (CC BY-NC-ND)
- **Sources:** `UI_Design_Language.md` · `Architecture_Principles.md` · `Project_Rules.md`

---

## 🚀 Quick Start

### Docker — pre-built (easiest)

```bash
cat > docker-compose.yml << 'EOF'
services:
  app:
    image: ghcr.io/farukylmz0550/bookshelf:latest
    restart: unless-stopped
    environment:
      DATABASE_URL: file:/data/bookshelf.db
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      NEXTAUTH_URL: ${NEXTAUTH_URL}
      VAPID_PUBLIC_KEY: ${VAPID_PUBLIC_KEY:-}
      VAPID_PRIVATE_KEY: ${VAPID_PRIVATE_KEY:-}
      VAPID_SUBJECT: ${VAPID_SUBJECT:-}
      CRON_SECRET: ${CRON_SECRET:-}
    ports:
      - "${APP_PORT:-1024}:3000"
    volumes:
      - app-data:/data

  cron:
    image: ghcr.io/farukylmz0550/bookshelf:latest
    restart: unless-stopped
    depends_on:
      - app
    entrypoint: ["node", "-e"]
    command: >
      "const auth = 'Bearer ' + process.env.CRON_SECRET;
       const urls = [
         ['streak-remind', 'http://app:3000/api/push/streak-remind'],
         ['overdue-remind', 'http://app:3000/api/push/overdue-remind']
       ];
       async function tick() {
         for (const [name, url] of urls) {
           try {
             const res = await fetch(url, { method: 'POST', headers: { Authorization: auth } });
             console.log('[cron]', name + ':', res.status);
           } catch (err) { console.log('[cron] failed:', name, err.message); }
         }
       }
       (async () => { await tick(); })();
       setInterval(tick, 24 * 60 * 60 * 1000);"
    environment:
      CRON_SECRET: ${CRON_SECRET:-}
volumes:
  app-data:
EOF

echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)" > .env
echo "CRON_SECRET=$(openssl rand -base64 32)" >> .env
docker compose up -d
# → http://localhost:1024
```

### Build from source

```bash
git clone https://github.com/farukylmz0550/bookshelf-web.git
cd bookshelf-web
cp .env.example .env  # set NEXTAUTH_SECRET=$(openssl rand -base64 32)
docker compose up -d --build
```

### Upgrading to 2.9.2 — non-root container

Since 2.9.2 the container runs as an unprivileged user (`nextjs`) instead of root. Fresh installs work out of the box. On an **existing** installation, the SQLite database inside the `app-data` volume is still owned by root, so the first start after upgrading will fail on migration with a permission error. Fix it once:

```bash
docker compose down
docker compose run --rm --user root --entrypoint chown app -R nextjs:nodejs /data
docker compose up -d
```

If you use a **bind mount** instead of the named volume, make sure the host data directory is writable by the container user (uid/gid of `nextjs` — run `docker run --rm ghcr.io/farukylmz0550/bookshelf:latest id nextjs` to look it up), e.g. `sudo chown -R <uid>:<gid> /path/to/data` on the host.

### Local dev

```bash
git clone https://github.com/farukylmz0550/bookshelf-web.git && cd bookshelf-web
npm install
npx prisma migrate dev
npm run db:seed
npm run dev  # → http://localhost:3000
```

**First run:** `/setup` → create admin → `/login` → approval at `/admin/users` → add books.

---

## 🧱 Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript `strict` |
| UI | Tailwind 4 · shadcn/ui · lucide-react (Sun/Moon ISC) · Recharts · Noto |
| DB | SQLite · Prisma 7 (`better-sqlite3`) |
| Auth | NextAuth v5 (Credentials/JWT/bcrypt, approval guard) |
| Validation | Zod (trim, max, url) |
| Format | Prettier + ESLint (`flat` + `prettier`) |
| Test | Vitest 97 unit · Playwright 25 e2e |
| i18n | Cookie locale, 6 dicts |
| Theme | Cookie `light/dark` (consent-gated) |
| PWA | `sw.js` + `manifest.json` + `sw-register.tsx` |
| Deploy | Docker multi-stage · GHCR |

---

## 📁 Project Structure

<details>
<summary>Click to expand</summary>

```
bookshelf/
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── books/            # Card/List toggle · ISBN one-click + detailed arrow · filters · Excel
│   │   │   │   ├── books-add-section.tsx
│   │   │   │   ├── book-card.tsx          # h-[380px] 60/40 object-contain
│   │   │   │   ├── books-grid.tsx
│   │   │   │   └── [id]/                 # detail / edit / lending / personal
│   │   │   ├── lending/ · people/ · stats/ · achievements/ · leaderboard/ · profile/ · settings/ · more/ · admin/
│   │   │   └── layout.tsx        # Hybrid shell: sidebar (desktop) + bottom-nav (mobile)
│   │   ├── actions/              # books/lending/people/goals/excel/profile/covers/admin/locale/theme/logout/settings/cookies
│   │   ├── api/                  # auth / test/reset / streak / well-known
│   │   └── login/register/setup/
│   ├── components/
│   │   ├── ui/                   # shadcn (token-aware)
│   │   ├── sidebar.tsx           # collapsible, cookie sidebar-collapsed
│   │   ├── bottom-nav.tsx        # safe-area
│   │   ├── cookie-consent.tsx    # desktop modal / mobile bar
│   │   └── theme-dropdown.tsx    # Sun/Moon
│   ├── lib/
│   │   ├── books/ · cookies* · isbn.ts (full meta) · gamification-pure.ts (Fibonacci) · streak.ts
│   │   └── theme.ts              # light/dark only
│   └── i18n/  auth.ts  proxy.ts
├── prisma/  schema.prisma  seed.ts/cjs  migrations/
├── e2e/  *.spec.ts  screenshots/
├── public/  sw.js  manifest.json  icon.svg
├── UI_Design_Language.md  Architecture_Principles.md  Project_Rules.md
├── Dockerfile  docker-compose.yml  vitest.config.ts
```

</details>

---

## 🗃️ Data Model

```
User ──────┬── Book ──────── LendingRecord
           ├── Person ────── LendingRecord
           ├── Goal
           └── UserAchievement ── Achievement
```

| Model | Key fields |
|---|---|
| **User** | email, passwordHash, name, isAdmin, approved, xp, streak |
| **Book** | isbn/title/author/coverUrl/status/rating/tags/copies + subtitle/publishers/publishDate/publishPlaces/edition/series/pages/languages/isbn10/13/subjects (full Open Library) |
| **Person** | name (unique per user) |
| **LendingRecord** | book, borrower, lentAt, returnedAt, bookTitle, personId |
| **Goal / Achievement / UserAchievement** | yearly/monthly, 8 achievements |

---

## 🔧 Server Actions

All mutations via `src/app/actions/` — `awardXp()` + `syncAchievements()` after:

| File | Mutations |
|---|---|
| `books` | `add` (full meta) · `update` · `delete` · `setStatus` · `lookupIsbn` (one-click) |
| `lending` | `create` · `return` |
| `people` | `create` · `remove` |
| `goals` | `set yearly/monthly` |
| `excel` | `export` · `template` · `import` |
| `profile` | `updateName` · `changePassword` |
| `admin` | `approve/reject` · `toggleAdmin` · `deleteUser` |
| `locale` / `theme` | `switch` (consent-gated, Settings-only) |
| `settings` / `cookies` | `updateSettings` · `setConsentCookie` |

---

## 🔑 Environment

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | `file:./prisma/dev.db` | SQLite path |
| `NEXTAUTH_SECRET` | Yes | — | JWT secret |
| `NEXTAUTH_URL` | No | `http://localhost:3000` | App URL |
| `APP_PORT` | No | `3000` | Docker port |
| `RESET_SECRET` | No | — | `/api/test/reset` |
| `ALLOW_REGISTRATION` | No | `true` | `false` to disable public sign-up |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | No | — | Web Push — `npx web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | No | `mailto:…` | Push contact URL |
| `CRON_SECRET` | No | — | Bearer token for the cron service (`/api/push/streak-remind`) |
| `READ_EVENT_PAGES` | No | `20` | Pages logged per "I read N pages" click |
| `XP_BOOK_ADDED` | No | `5` | XP per added book |
| `XP_BOOK_FINISHED_BASE` | No | `50` | XP base for finishing a book |
| `XP_PAGES_PER_10` | No | `3` | XP per 10 read pages |
| `XP_LENDING` | No | `5` | XP per lending |
| `XP_PER_LEVEL_BASE` | No | `100` | Fibonacci level-curve base XP |

---

## ✅ Testing

```bash
npm test              # 97 unit (vitest)
npx playwright test   # 25 e2e (chromium, webServer: npm run dev)
npm run lint
npm run format:check
```

---

## 🤝 Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) — TypeScript strict, Prettier 120 width, Conventional Commits, `npm run lint && npm run format:check && npm test` before push.

---

## 📄 License

**GPLv3** — Only source code is licensed under the GPLV3 license

**CC-BY-NC-ND** — The Book Shelf logo, brand assets, and all materials contained within the brand set directory are licensed under the CC BY-NC-ND 4.0 license.

**Book Shelf** — is an unregistered trademark that identifies the Book Shelf project and the brand associated with the project.

**The Book Shelf name, logo, and brand identity are not licensed under the GNU GPLv3.** Use of the Book Shelf source code under the GNU GPLv3 does not grant any trademark rights to use the Book Shelf name or brand identity.

Forked and modified versions of the software may be used and distributed under the terms of the GNU GPLv3. However, unless separate permission to use the Book Shelf trademark is granted, such versions must use a different project name and brand identity.

The Book Shelf name or logo must not be used in a way that creates the impression that a project is approved, supported, endorsed, or officially associated with Book Shelf.

**Master files:** [`Bookshelf — Color Master.svg`](https://github.com/farukylmz0550/bookshelf-web/blob/main/Bookshelf%20%E2%80%94%20Color%20Master.svg) · [`Bookshelf — Symbolic Master.svg`](https://github.com/farukylmz0550/bookshelf-web/blob/main/Bookshelf%20%E2%80%94%20Symbolic%20Master.svg)

<div align="center">

*Cozy Library + Personal Collection · Clarity before decoration.*

**[⬆ back to top](#book-shelf)**

</div>

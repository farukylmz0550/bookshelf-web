# Troubleshooting — Book Shelf

Symptom → cause → fix guides for self-hosted deployments and daily use.
This guide describes the current behavior of `main` as of **v2.10.1**.
Paths in parentheses point at the source file that implements the
behavior, so you can verify or patch locally.

> Quick links: [Docker & startup](#1-docker--startup) ·
> [Database & backups](#2-database--backups) · [Login & accounts](#3-login--accounts) ·
> [TOTP 2FA](#4-totp-two-factor-authentication) · [Passwords](#5-passwords) ·
> [Admin](#6-admin) · [Books & ISBN](#7-books--isbn) · [Shelves](#8-shelves) ·
> [Lending & people](#9-lending--people) · [Import](#10-import-excel--goodreads) ·
> [Theme & cookies](#11-theme-language--cookies) · [Notifications & cron](#12-notifications--cron) ·
> [PWA & offline](#13-pwa--offline) · [Barcode scanner](#14-barcode-scanner) ·
> [Development](#15-development-environment) · [Known limitations](#16-known-limitations)

---

## 1. Docker & startup

### Container restarts in a loop right after upgrade

- **Symptom:** `docker compose up -d` → container exits, `Restarting` status; `docker compose logs app` ends with a Prisma or seed error.
- **Cause:** the entrypoint runs `npx prisma migrate deploy` and then re-seeds achievements when the `Achievement` table is empty or unreadable — with `set -e`, any failure aborts the container (`docker-entrypoint.sh`).
- **Fix:**
  1. Read the exact error: `docker compose logs app`.
  2. Check the data volume is writable (see "attempt to write a readonly database" below).
  3. If migrations are corrupt, restore the pre-upgrade backup (see §2) and retry the upgrade.

### `attempt to write a readonly database` / `SQLITE_CANTOPEN`

- **Symptom:** crash at startup during migration or seed.
- **Cause:** the container runs as the non-root `nextjs` user; SQLite must be able to write both `bookshelf.db` and its `-wal`/`-shm` files in the data directory.
- **Fix:** named volumes (`app-data:/data`) work out of the box. If you **bind-mount a host directory**, make it writable by the container user:
  ```sh
  docker compose run --rm --entrypoint sh app -c "id"   # note the uid (nextjs)
  sudo chown -R <uid>:<gid> /path/to/your/data-dir
  ```

### Login loops or `UntrustedHost` after signing in

- **Cause:** `NEXTAUTH_SECRET` missing/unstable (it must survive restarts — never regenerate it while sessions exist) or `NEXTAUTH_URL` not matching the URL you actually browse (scheme, host, **and port**).
- **Fix:** set both in the compose environment, e.g. `NEXTAUTH_URL=http://192.168.1.10:1024` for LAN access. `AUTH_TRUST_HOST=true` is already set by the shipped compose file.

### App comes back as the first-run `/setup` screen after restart

- **Cause:** `DATABASE_URL` is a **relative** path (default `file:./prisma/dev.db`) and resolves against the process working directory — if the volume is not mounted at that path, the app silently opens a brand-new, empty database (`src/lib/db.ts`).
- **Fix:** always use an absolute path inside the mounted volume, as the shipped compose does: `DATABASE_URL: file:/data/bookshelf.db`. Your old data is not lost — it is in a different file. Point the URL back at it.

### Port already in use

- Change `APP_PORT` in your `.env` (compose maps `${APP_PORT:-1024}:3000`).

### `SQLITE_BUSY` / raw SQLite errors in toasts

- **Cause:** more than one app instance writing to the same SQLite file, or the cron container pointing at the wrong URL. The app is **single-instance by design** — rate limiters and finish-claim maps are per-process.
- **Fix:** run exactly one `app` service against the data volume. The cron container does not touch the DB (it only calls the push API).

### Wrong image version after `docker compose pull`

- `latest` follows the newest published release; a specific version pin like `2.10.0` never moves. Confirm which tag your compose file references, then `docker compose pull && docker compose up -d`.

---

## 2. Database & backups

### Backing up before an upgrade (recommended)

The whole state is one SQLite file. Stop the app first so the WAL is checkpointed:

```sh
cd /path/to/compose/dir
docker compose stop app
docker run --rm -v bookshelf_app-data:/data -v "$PWD":/backup alpine \
  cp /data/bookshelf.db /backup/bookshelf-backup-$(date +%F).db
docker compose start app
```

(The volume name is `<project>_app-data` — check with `docker volume ls`.)

### A migration fails mid-upgrade

1. `docker compose logs app` — copy the Prisma error.
2. Restore the backup from §2.
3. Check the release notes / `CHANGELOG.md` for required environment changes, then re-run the upgrade.

### Deleting all data intentionally

Use the admin **Danger zone** card (`/admin`) — it deletes every non-admin account (cascading books, shelves, lending, goals, achievements) after a TOTP confirmation. Admin accounts, the achievement catalog and app settings survive. For a full wipe, delete the volume and start fresh (`docker compose down -v` **destroys everything**).

---

## 3. Login & accounts

### "Your account is pending admin approval."

Self-registered accounts start unapproved. An admin approves them at `/admin` → User management. There is no self-service approval.

### "Registration is disabled" / "Setup admin account first at /setup"

- `ALLOW_REGISTRATION=false` disables self-registration (set it to `true` in the environment to allow it).
- Registering before any admin exists fails — run `/setup` first.

### "Invalid email or password" but the credentials are correct

Production deployments throttle login **per IP: 10 attempts / 5 minutes** (`src/lib/rate-limit.ts`). Exceeding the bucket also surfaces as this generic message. Wait out the window or restart the container — the limiter is in-memory and resets on restart. Note the window restarts on *any* attempt once it has expired, so hammering the form keeps it alive.

### Rate limits at a glance (production only — dev is unlimited)

| Action | Limit | Window | Key |
| --- | --- | --- | --- |
| Login (password) | 10 | 5 min | per IP |
| TOTP at login | 5 | 5 min | per account |
| TOTP enroll/disable/verify | 5 | 5 min | per account |
| Admin danger-zone wipe | 5 | 5 min | per admin |
| Register / first-run setup | 5 | 60 s | per IP |
| `/api/*` requests | 100 | 1 min | per IP + path |
| Kobo sync (`/api/kobo/<token>/*`, v3.0.0) | 100 | 1 min | per device token |

All counters are in-memory: restarting the container clears them.

### "Something went wrong" full-page error

Some server actions throw instead of returning a structured error (notably the **lending form** and the streak-shield widget). The Next.js error screen shows the raw message plus a **Try again** button — reloading the page is always safe; failed actions did not partially commit anything user-visible.

### "Page not found" for a valid-looking URL

Foreign (another user's) book or shelf ids deliberately 404. You are logged into the wrong account, or the record belongs to another user.

---

## 4. TOTP two-factor authentication

### Login asks for a 6-digit code (`TOTP_REQUIRED`)

Enter the current code from your authenticator app. Codes rotate every 30 s; the server tolerates ±30 s of drift (`src/lib/totp.ts`) — keep your phone's clock on automatic time.

### "Invalid code — try again."

- You typed the code for the previous/next window — wait for the next code.
- After **5 failed attempts in 5 minutes** the account is locked out temporarily (surfaces as the generic invalid-credentials message). Wait or restart the container.
- If codes never work: check that the app's secret was copied correctly (spaces are ignored) and that the issuer is `Book Shelf`.

### Lost the authenticator (locked out)

There is **no in-app recovery** — no email channel, and the admin password reset does not touch TOTP. Manual fix, per affected user:

```sh
cd /path/to/compose/dir
docker compose stop app
docker compose run --rm --entrypoint node app -e "
  const db = require('better-sqlite3')(process.env.DATABASE_URL.replace(/^file:/, ''));
  db.prepare('UPDATE User SET totpEnabled = 0 WHERE email = ?').run('user@example.com');
  console.log(db.prepare('SELECT email, totpEnabled FROM User WHERE email = ?').get('user@example.com'));
"
docker compose start app
```

The user can then log in with the password only and re-enroll TOTP from **Settings → Security** (a fresh secret is generated; the old one is irrelevant). After any manual database edit, restart the app container.

### Admin is blocked by the mandatory-2FA gate

Admin accounts must enable TOTP before the dashboard opens in **production** deployments (dev/e2e skip the gate). Use the QR shown in the gate dialog. If the admin also lost the authenticator, apply the recovery command above and re-enroll — the gate reappears until setup is completed.

### "Two-factor authentication is mandatory for admin accounts."

Admins cannot disable TOTP from Settings — the button is disabled and the server rejects it (`ADMIN_REQUIRED`). This is by design. Demote the account first if you truly need a 2FA-less user.

---

## 5. Passwords

### Forgot a **user** password

Ask an admin to click the **key icon** on the user's row in `/admin` — it assigns a random 12-character password (shown **once**, copyable) and flags the account for a forced change. The user logs in with that password and the app forces a new password via a full-screen dialog before anything else opens.

### Forgot the **admin** password

The admin row cannot be reset through the UI (`ADMIN_TARGET`). Two options:

- Another admin account (if you promoted one) resets it via the key icon.
- Manual reset — stop the app, then:
  ```sh
  docker compose run --rm --entrypoint node app -e "
    const db = require('better-sqlite3')(process.env.DATABASE_URL.replace(/^file:/, ''));
    const bcrypt = require('bcryptjs');
    db.prepare('UPDATE User SET passwordHash = ?, mustChangePassword = 0 WHERE email = ?')
      .run(bcrypt.hashSync('NEW_PASSWORD_HERE', 12), 'admin@example.com');
  "
  docker compose start app
  ```
  (Single-quote the shell snippet and avoid `'` inside the password.)

### "Password must be at least 8 characters"

Minimum length is 8 everywhere (register, change, forced change).

### "Current password is incorrect"

Changing your password in Profile requires the current one — it is not recoverable, only resettable (see above).

---

## 6. Admin actions

| Message | Meaning / fix |
| --- | --- |
| "You cannot perform this action on your own account" | Self-guard: approve/reject/delete yourself via a second admin, or log out and use another account. |
| "Cannot delete the last admin" / "Cannot demote the last admin" | Promote another admin first. |
| Danger zone: "Invalid code — try again." | The TOTP code was wrong — codes rotate every 30 s. |
| Danger zone: "Too many attempts…" | 5 attempts / 5 min per admin. Wait. |
| Danger zone does nothing + generic text | Your admin account has not completed TOTP setup yet (`TOTP_NOT_ENABLED`). Finish 2FA setup first. |
| Key icon disabled for a user | It is your own row (self-guard) or an admin account (by design — see §5). |

Note: **Clear cover cache** is global — it wipes every user's stored cover URLs; covers re-download on demand.

---

## 7. Books & ISBN

### "ISBN not found — enter details manually."

Open Library has no record for that ISBN. Enter the details manually; the book works fully without lookup data.

### "Lookup failed. Try again."

Open Library was unreachable or throttled. The client retries 3× with backoff (10 s timeout per attempt) — a persistent failure usually means outbound internet is blocked from the container or the service is throttling you. Bulk lookups are throttled to 5 requests/s and stop after 3 consecutive failures, so a dead network shows up as **fewer imported rows**, not an error screen.

### "Finish the remaining pages first — the book auto-finishes when all pages are read."

You set a total page count and tried to mark the book finished while `currentPage < numberOfPages`. Either keep logging pages (the book auto-finishes) or set **Current page** equal to the total on the book page, then finish.

### "Conflict, please retry"

Two devices logged the same reading at the same time and the optimistic lock rejected one. Press the button again — nothing was double-counted.

### "Could not log reading"

Generic failure for page logging / re-read. Most often the book row changed or vanished server-side; reload the page and retry.

### Copy count vs. lending

`copies` only gates lending. If you lower `copies` below the number currently lent out, further lends fail with "All copies are out" until you raise it again.

### Broken cover images

Covers are fetched from Open Library with `?default=false`; books without a cover there store a 404-ing URL and render a broken image until the cover cache is cleared from `/admin` (re-fetch happens on demand).

### Deleting books

Not implemented in the app — there is no delete action. Remove rows directly in the database if truly needed (with the app stopped), or hide them behind shelves/filters.

---

## 8. Shelves

| Message | Meaning / fix |
| --- | --- |
| "A shelf with this name already exists." | Names are unique per user (max 60 chars). |
| "Something went wrong. Please try again." | Anything else (stale page, vanished shelf, reorder race). Reload and retry. |
| Invalid color | Only the 12 palette swatches or a `#rrggbb` hex value are accepted. |

The bulk "+" picker only lists **your own** books; books already on the shelf are shown marked and are not re-added.

---

## 9. Lending & people

| Message | Meaning / fix |
| --- | --- |
| "All copies are out" | Open loans ≥ physical `copies`. Return a copy first or raise the copy count on the book page. |
| "Invalid due date" / "Due date must be in the future" | The server validates in UTC end-of-day; a "today" pick can be rejected around midnight UTC — pick tomorrow or later. |
| "Invalid borrower name" | 1–200 characters. |
| "Person already exists" | Names are normalized (case/spacing-insensitive) per user. |
| "Still has books out" | Return the person's loans before deleting them. |
| Native browser alert (e.g. "All copies are out") on the book page | Intentional: the per-book lending box surfaces thrown action errors as an `alert()`. |

---

## 10. Import (Excel / Goodreads)

### "Imported 0 books" without an error

- The Excel importer only accepts **checksum-valid ISBN-10/13** values from any sheet/cell — everything else is skipped silently. Also note Open Library misses: the import counts only books actually found, so a dead network yields 0 with no error.
- Goodreads CSV must contain a `Title` column header; rows missing `Title` are reported as "Row N: missing Title".

### "File too large (20MB limit)" / "Too many rows (5000 max)"

Hard server limits; split the file.

### Duplicate handling

ISBN match, or title+author match when no ISBN. Duplicates are counted, not re-imported — they appear in the success summary as "duplicates skipped".

---

## 11. Theme, language & cookies

### "My theme/language won't persist"

If you answered the cookie banner with **preferences rejected**, theme and locale choices are deliberately not persisted (cookie-consent gate). Re-open Cookie preferences and allow the *Preferences* category.

### Admin reading-settings change "didn't apply"

*(v2.x behavior removed in v3.0.0.)* Reading/XP values are no longer editable in the admin panel — they live in `config.yaml` (site-wide). The loader caches the file for 60 s; restart the container after editing to apply immediately.

---

## 11b. Kobo Sync (v3.0.0)

### Kobo "Sync failed" after pointing `api_endpoint` at the server

Most common causes, in order:

1. **No valid HTTPS** — the device refuses self-signed/plain-HTTP endpoints. Use a reverse proxy or tunnel with a trusted certificate.
2. **Sync URL rotated** — creating a new URL in Settings invalidates the old one; re-copy `api_endpoint` into `Kobo eReader.conf`.
3. **`kobo.enabled: false`** in `config.yaml` — the endpoints answer 404.
4. Check reachability without the device: `npm run kobo:sim -- https://your-host <sync-token>`.

### "Books sync but never download" / empty downloads

Book files come from **your own URL template** (Settings → Kobo Sync). If no template is set, or a book has no ISBN, the device shows the book but the download 404s. Template placeholders: `{isbn}`, `{isbn10}`, `{isbn13}`.

### Progress from the device doesn't show in the app

Progress write-back happens on each device sync (`/v1/library/{id}/state`): the reported position updates `currentPage`, streak activity and auto-finish. Re-reported identical positions award nothing (no XP farming by re-syncing). If progress doesn't appear, confirm the device actually synced (not only opened the book) — states are sent during sync.

### Old XP/reading values after the 3.0.0 upgrade

v3.0.0 dropped the `AppSettings` table: admin-panel XP values are gone and `config.yaml` values apply. `XP_*` environment variables are no longer read.

---

## 12. Notifications & cron

### No push notifications at all, silently

Push requires the three `VAPID_*` environment variables. Without them the service worker never subscribes and the server throws "VAPID keys not configured" — check `docker compose logs` and the compose `VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT` values. Use the "Send test" button in Settings → Notifications to verify.

### "No push subscription found"

No device subscribed yet — open the app in the browser you want to receive pushes and accept the notification prompt. If you previously **denied** the browser permission, no re-ask UI appears: reset the site permission in the browser settings.

### Cron log shows `[cron] streak-remind: 503` or `401`

- `503` = `CRON_SECRET` unset on the app (harmless but noisy — set it in `.env`).
- `401` = secret mismatch between the cron service and the app.
- These run once a day via the `cron` service in docker-compose.

---

## 13. PWA & offline

### App shows an old page after an update

Navigations are served **network-first**, but if the server is unreachable the last cached copy is used, with `/offline.html` as the final fallback. After upgrading the container, do a hard refresh; the service worker also shows "New version available — refresh the page to update" when a new version activates.

### Offline book adds

Adding a book while offline queues it in browser localStorage and syncs on reconnect (toast: "Offline — book saved locally…"). Only book creation is queued; server actions (status changes, lending, notes) need connectivity. Background sync is **Chromium-only** — on Firefox/Safari the queue flushes on the next page load instead. Note the queue retries indefinitely; clear site data if a permanently invalid entry keeps failing.

### Install prompt never shows

Only Chromium/Android fires `beforeinstallprompt`; iOS Safari uses Share → "Add to Home Screen". Once dismissed, the prompt is suppressed permanently (clear site data to re-see it).

---

## 14. Barcode scanner

- Requires **HTTPS or localhost** (camera API) and a mobile-width viewport — the button is hidden on desktop.
- "Barcode scanner failed to load" → the html5-qrcode module could not load (offline or old browser).
- "Invalid barcode: …" → the scanned digits are not a valid ISBN-10/13; scan the ISBN barcode, not the EAN of other products.

---

## 15. Development environment

| Problem | Fix |
| --- | --- |
| `better-sqlite3` NODE_MODULE_VERSION mismatch after a Node upgrade | `npm rebuild better-sqlite3` |
| Prisma types out of date after pulling a schema change | `npx prisma generate` |
| Achievements/leaderboard page empty locally | `npm run db:seed` (the entrypoint only seeds when the catalog is empty) |
| Port 3000 busy | `next dev -p 3001` (and `PLAYWRIGHT_BASE_URL` for e2e) |
| e2e "Executable doesn't exist" | `npx playwright install chromium` |
| `.env` missing | copy `.env.example` and fill `NEXTAUTH_SECRET`, `NEXTAUTH_URL` |
| Login/throttle oddities in dev | throttles are production-only; nothing to do |

---

## 16. Known limitations

Documented so they are not mistaken for bugs:

- **No book deletion** and **no in-app TOTP recovery** (see §7 / §4).
- **Single instance only** — one app process per database file; no Redis-backed limiter.
- Rate limiters and session state are in-memory and reset on container restart.
- The offline-queue success toast is currently hardcoded in Turkish (`offline-queue.ts`).
- Goodreads/ISBN enrichment depends on Open Library availability; metadata is never fabricated.
- Sessions are JWTs valid ~30 days; signing out other devices is not possible (no server-side session store).
- **Kobo Sync is simulation-verified only** (no hardware test yet): books deleted from the library are not removed from the device, and metadata edits made after a book's first sync are not re-pushed until re-rotating the sync token.

# Contributing to Bookshelf

Thanks for your interest in contributing! This guide covers code style, git workflow, and PR process.

---

## Code Style

### General Principles

- **TypeScript everywhere** — no `.js`/`.cjs`/`.mjs` files except config (`*.config.*`, `postcss.config.*`) and two documented runtime exceptions:
  - `public/sw.js` — Service Worker runtime (must be served as ` /sw.js` at origin root; browser ServiceWorker scope cannot import TS directly)
  - `prisma/seed.cjs` — Docker production fallback ( `tsx` is dev-only per `MEMORY.md`; `seed.ts` is the TS source of truth, `seed.cjs` is the plain-JS equivalent for `node` without `tsx`)
- **Strict mode** — `any` only when truly unavoidable (with `eslint-disable` comment explaining why)
- **Functional over class-based** — prefer pure functions for domain logic
- **Single Responsibility** — one function/file does one thing
- **No comments** unless the logic is genuinely non-obvious (the code should speak for itself)

### Formatting

This project uses [Prettier](https://prettier.io) for consistent formatting.

```bash
npm run format         # Auto-format all files
npm run format:check   # Check without modifying (CI)
```

**Config** (`.prettierrc`):
- Semicolons: yes
- Quotes: double
- Trailing commas: all
- Print width: 120
- Tab width: 2

### Linting

```bash
npm run lint           # Must pass before commit
```

Next.js core-web-vitals + TypeScript rules. No `eslint-disable` unless justified.

### Naming Conventions

| What | Convention | Example |
|------|-----------|---------|
| Component files | PascalCase | `BookCard.tsx` |
| Utility/logic files | camelCase | `filters.ts` |
| Test files | `*.test.ts` | `filters.test.ts` |
| Functions | camelCase | `allows()`, `sortKey()` |
| React components | PascalCase | `BookCard` |
| Types/aliases | PascalCase | `AchievementStats` |
| Constants | UPPER_SNAKE_CASE | `XP_REWARDS` |
| Prisma models | PascalCase | `User`, `Book` |
| Prisma fields | camelCase | `passwordHash` |
| CSS classes | Tailwind utility | `rounded-lg` |
| Route folders | lowercase | `(dashboard)`, `books` |
| Action files | camelCase | `addBook`, `createLending` |

### Import Order

```typescript
// 1. Node built-ins
import path from "path";

// 2. External packages
import { z } from "zod";
import bcrypt from "bcryptjs";

// 3. Internal (using @/ alias)
import { db } from "@/lib/db";
import { allows } from "@/lib/books/filters";
```

### Function Patterns

**Pure functions** for domain logic (no DB, no side effects):

```typescript
export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
}
```

**Server actions** for mutations (with auth check):

```typescript
"use server";

export async function addBook(input: BookInput) {
  const userId = await requireUserId();
  // ...
}
```

**JSDoc** on exported pure functions:

```typescript
/** Level from total XP. Pure function — level is derived, never stored. */
export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
}
```

### Type Definitions

- Prefer `type` over `interface` for consistency
- Co-locate with usage, or group in `src/types/`
- Use `as const` for literal arrays/objects

```typescript
export const XP_REWARDS = {
  BOOK_ADDED: 5,
  BOOK_FINISHED: 50,
  LENDING_CREATED: 5,
} as const;
```

---

## Project Structure

```
src/
├── app/
│   ├── actions/        # Server actions (one per domain)
│   ├── (dashboard)/    # Page components
│   ├── api/            # API routes
│   ├── login/          # Auth pages
│   ├── register/
│   └── setup/
├── components/ui/      # Shared UI components (shadcn)
├── lib/                # Pure domain logic + DB client
│   ├── books/          # Book-specific logic
│   └── *.ts            # Cross-cutting concerns
├── i18n/               # Dictionaries
└── types/              # TypeScript declarations
```

---

## Git Workflow

### Commit Messages

Follow **Conventional Commits**:

```
type(scope): short description
```

| Type | When to use |
|------|------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `chore` | Build, tooling, deps |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding missing tests |
| `style` | Formatting, no code change |
| `perf` | Performance improvement |

**Examples:**

```
feat: add book by ISBN lookup
fix: resolve lending race condition
docs: rewrite README from scratch
chore: add prettier for code formatting
refactor: extract filter logic to separate module
test: add unit tests for tag normalization
```

**Rules:**
- Lowercase, imperative mood ("add" not "added")
- No period at the end
- Max 72 characters
- Scope is optional (e.g., `fix(books): ...`)

### Branch Naming

```
feat/book-bulk-import
fix/lending-return-bug
chore/update-deps
docs/contributing-guide
```

### Workflow

**Commit and push after every logical step is completed.** A "step" means a single responsibility is fulfilled (e.g., a module, a fix, an e2e spec, a config change).

1. Create branch from `main`
2. Make changes
3. Run checks before every commit:
   ```bash
   npm run lint && npm run format:check && npm test
   ```
4. Commit with conventional message
5. Push: `git push origin <branch-name>`
6. Repeat for each logical step, then open a PR (see [PR Process](#pr-process))

> **Note:** pushing directly to `main` is reserved for the maintainer's own
> releases; external contributors go through the branch/PR workflow below.

---

## Testing

### Unit Tests (Vitest)

- **Location:** `src/lib/**/*.test.ts`
- **Framework:** Vitest
- **Run:** `npm test`
- **Pattern:** `describe()` + `it()` blocks
- **Target:** Pure functions only, not server actions

```typescript
import { describe, expect, it } from "vitest";
import { levelForXp } from "@/lib/gamification";

describe("levelForXp", () => {
  it("returns 1 for 0 xp", () => {
    expect(levelForXp(0)).toBe(1);
  });

  it("increases with more xp", () => {
    expect(levelForXp(100)).toBeGreaterThan(1);
  });
});
```

**Guidelines:**
- Test edge cases (0, negative, NaN, MAX_SAFE_INTEGER)
- One `describe` block per function
- Test names describe the expected behavior
- No mocks for pure functions

### E2E Tests (Playwright)

- **Location:** `e2e/*.spec.ts`
- **Framework:** Playwright
- **Run:** `npx playwright test`
- **Setup:** Each test resets DB via `/api/test/reset`

**Guidelines:**
- Each spec file is self-contained
- Use `test.beforeEach` for common setup
- Test user-visible behavior, not implementation details

---

## PR Process

1. **Fork** or create a branch from `main`
2. **Make changes** following the code style above
3. **Ensure all checks pass:**
   ```bash
   npm run lint
   npm run format:check
   npm test
   ```
4. **Write clear commit messages** (conventional commits)
5. **Push** your branch
6. **Create PR** with:
   - Clear title describing the change
   - Description of what changed and why
   - Link to issue if applicable
7. **Wait for review** and address feedback
8. **Squash merge** after approval

---

## Releases (maintainer)

1. Bump the version in `package.json` and add a `CHANGELOG.md` entry
2. Commit + push `main`, then tag: `git tag X.Y.Z && git push origin X.Y.Z`
   (no `v` prefix — the 2.4.0+ convention)
3. **Every tag gets a matching GitHub Release** — create it right after the tag
   lands: `gh release create X.Y.Z --title "X.Y.Z" --notes "<changelog excerpt>"`
4. Tags without the `v` prefix don't auto-trigger the workflow — dispatch it
   manually (`gh workflow run docker-publish.yml --ref main`); it reads the
   version from `package.json` and publishes
   `ghcr.io/<owner>/bookshelf:latest` + `:X.Y.Z`

---

## Adding a New Feature

1. Add domain logic in `src/lib/` as pure functions
2. Write unit tests in `src/lib/*.test.ts`
3. Add server action in `src/app/actions/` if it mutates data
4. Create page component in `src/app/(dashboard)/`
5. Add i18n keys to all 6 dictionaries (`src/i18n/dictionaries/`)
6. Site-wide configurable values go in `config.yaml` + `src/lib/app-config.ts` (v3.0.0) — not the database
7. Update `README.md` if it's a user-facing feature

---

## Adding a New Achievement

1. Add rule to `ACHIEVEMENT_RULES` in `src/lib/gamification.ts`
2. Add i18n keys to all 6 dictionaries:
   - `{key}_title` — achievement name
   - `{key}_desc` — achievement description
3. Run `npm run db:seed` to register the achievement

---

## Questions?

Open an issue or reach out to the maintainers.

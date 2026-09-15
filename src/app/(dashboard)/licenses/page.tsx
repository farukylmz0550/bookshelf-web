// SPDX-License-Identifier: GPL-3.0-only
import { getDictionary } from "@/i18n/get-dictionary";
import { Scale } from "lucide-react";

type LicenseEntry = {
  name: string;
  url: string;
  license: string;
  licenseUrl: string;
};

const LICENSES: LicenseEntry[] = [
  {
    name: "Next.js",
    url: "https://nextjs.org",
    license: "MIT",
    licenseUrl: "https://github.com/vercel/next.js/blob/canary/license",
  },
  {
    name: "React",
    url: "https://react.dev",
    license: "MIT",
    licenseUrl: "https://github.com/facebook/react/blob/main/LICENSE",
  },
  {
    name: "NextAuth.js",
    url: "https://next-auth.js.org",
    license: "ISC",
    licenseUrl: "https://github.com/nextauthjs/next-auth/blob/main/license",
  },
  {
    name: "Prisma",
    url: "https://www.prisma.io",
    license: "Apache-2.0",
    licenseUrl: "https://github.com/prisma/prisma/blob/main/LICENSE",
  },
  {
    name: "better-sqlite3",
    url: "https://github.com/WiseLibs/better-sqlite3",
    license: "MIT",
    licenseUrl: "https://github.com/WiseLibs/better-sqlite3/blob/master/LICENSE",
  },
  {
    name: "Tailwind CSS",
    url: "https://tailwindcss.com",
    license: "MIT",
    licenseUrl: "https://github.com/tailwindlabs/tailwindcss/blob/main/LICENSE",
  },
  {
    name: "shadcn/ui",
    url: "https://ui.shadcn.com",
    license: "MIT",
    licenseUrl: "https://github.com/shadcn-ui/ui/blob/main/LICENSE.md",
  },
  {
    name: "Lucide",
    url: "https://lucide.dev",
    license: "ISC",
    licenseUrl: "https://github.com/lucide-icons/lucide/blob/main/LICENSE",
  },
  {
    name: "Recharts",
    url: "https://recharts.org",
    license: "MIT",
    licenseUrl: "https://github.com/recharts/recharts/blob/master/LICENSE",
  },
  {
    name: "Zod",
    url: "https://zod.dev",
    license: "MIT",
    licenseUrl: "https://github.com/colinhacks/zod/blob/main/LICENSE",
  },
  {
    name: "bcryptjs",
    url: "https://github.com/nicohman/bcryptjs",
    license: "MIT",
    licenseUrl: "https://github.com/nicohman/bcryptjs/blob/master/LICENSE",
  },
  {
    name: "ExcelJS",
    url: "https://exceljs.org",
    license: "MIT",
    licenseUrl: "https://github.com/exceljs/exceljs/blob/master/LICENSE",
  },
  {
    name: "Sonner",
    url: "https://sonner.emilkowal.ski",
    license: "MIT",
    licenseUrl: "https://github.com/emilkowalski/sonner/blob/main/license.md",
  },
  {
    name: "next-themes",
    url: "https://github.com/pacocoursey/next-themes",
    license: "MIT",
    licenseUrl: "https://github.com/pacocoursey/next-themes/blob/main/license",
  },
  {
    name: "TypeScript",
    url: "https://www.typescriptlang.org",
    license: "Apache-2.0",
    licenseUrl: "https://github.com/microsoft/TypeScript/blob/main/LICENSE",
  },
  {
    name: "ESLint",
    url: "https://eslint.org",
    license: "MIT",
    licenseUrl: "https://github.com/eslint/eslint/blob/main/LICENSE",
  },
  {
    name: "Prettier",
    url: "https://prettier.io",
    license: "MIT",
    licenseUrl: "https://github.com/prettier/prettier/blob/main/LICENSE",
  },
  {
    name: "Vitest",
    url: "https://vitest.dev",
    license: "MIT",
    licenseUrl: "https://github.com/vitest-dev/vitest/blob/main/LICENSE",
  },
  {
    name: "Playwright",
    url: "https://playwright.dev",
    license: "Apache-2.0",
    licenseUrl: "https://github.com/microsoft/playwright/blob/main/LICENSE",
  },
  {
    name: "class-variance-authority",
    url: "https://cva.tech",
    license: "MIT",
    licenseUrl: "https://github.com/joe-bell/cva/blob/main/LICENSE",
  },
  {
    name: "clsx",
    url: "https://github.com/lukeed/clsx",
    license: "MIT",
    licenseUrl: "https://github.com/lukeed/clsx/blob/master/license",
  },
  {
    name: "tailwind-merge",
    url: "https://github.com/dcastil/tailwind-merge",
    license: "MIT",
    licenseUrl: "https://github.com/dcastil/tailwind-merge/blob/main/license",
  },
  {
    name: "tw-animate-css",
    url: "https://github.com/wahbidev/tw-animate-css",
    license: "MIT",
    licenseUrl: "https://github.com/wahbidev/tw-animate-css/blob/main/LICENSE",
  },
  {
    name: "Base UI",
    url: "https://base-ui.com",
    license: "MIT",
    licenseUrl: "https://github.com/mui/base-ui/blob/master/LICENSE",
  },
  {
    name: "Docker",
    url: "https://www.docker.com",
    license: "Apache-2.0",
    licenseUrl: "https://github.com/moby/moby/blob/master/LICENSE",
  },
];

export default async function LicensesPage() {
  const dict = await getDictionary();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-[var(--font-serif)] text-2xl font-semibold tracking-tight text-foreground">
          {dict.licenses.title}
        </h1>
        <p className="font-[var(--font-sans)] text-sm text-muted-foreground">{dict.licenses.description}</p>
      </header>

      {/* Project licensing — code, trademark, brand and audio (v2.10.0) */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 font-[var(--font-sans)] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {dict.licenses.projectTitle}
        </h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="font-[var(--font-sans)] text-sm text-foreground">{dict.licenses.sourceCode}</span>
            <a
              href="https://www.gnu.org/licenses/gpl-3.0.html"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent"
            >
              GPLv3
            </a>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="font-[var(--font-sans)] text-sm text-foreground">{dict.licenses.logo}</span>
            <a
              href="https://creativecommons.org/licenses/by-nc-nd/4.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent"
            >
              CC-BY-NC-ND-4.0
            </a>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="font-[var(--font-sans)] text-sm text-foreground">{dict.licenses.music}</span>
            <a
              href="https://creativecommons.org/publicdomain/zero/1.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent"
            >
              CC0-1.0
            </a>
          </div>
          <p className="pt-1 font-[var(--font-sans)] text-xs leading-relaxed text-muted-foreground">
            {dict.licenses.trademark}
          </p>
        </div>
      </section>

      <div className="grid gap-2 sm:grid-cols-2">
        {LICENSES.map((lib) => (
          <div
            key={lib.name}
            className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
          >
            <div className="min-w-0">
              <a
                href={lib.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] font-medium text-foreground hover:underline"
              >
                {lib.name}
              </a>
            </div>
            <a
              href={lib.licenseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-3 shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent"
            >
              {lib.license}
            </a>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <Scale size={18} className="mt-0.5 shrink-0 text-muted-foreground" />
          <div className="text-xs leading-relaxed text-muted-foreground">
            <p>
              {dict.licenses.projectLicense}{" "}
              <a
                href="https://www.gnu.org/licenses/gpl-3.0.html"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground hover:underline"
              >
                GNU GPLv3
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

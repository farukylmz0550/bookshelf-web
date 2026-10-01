// SPDX-License-Identifier: GPL-3.0-only
import { defineConfig, devices } from "@playwright/test";

// Port is configurable: PLAYWRIGHT_PORT (default 3000). The webServer and
// baseURL share it so the suite always talks to the Bookshelf dev server —
// never to a foreign app squatting on a fixed port.
const PORT = getPort();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // v3.14.0 — port is configurable so the suite never lands on a foreign
    // app that happens to hold :3000 (reuseExistingServer would happily
    // adopt it — seen with the fetchfolio container on 2026-09-30).
    // 2026-10-01 — spawn via the local next binary, NOT `npm run dev`, and
    // probe 127.0.0.1, not localhost (this machine may lack an npm binary
    // entirely — Fedora ships nodejs without the npm package — and resolves
    // localhost to ::1 first while next dev binds IPv4).
    command: `node node_modules/next/dist/bin/next dev -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});

function getPort(): number {
  return Number(process.env.PLAYWRIGHT_PORT ?? 3000);
}

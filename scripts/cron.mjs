#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — scheduler sidecar.
//
// The previous inline `node -e "..."` command in docker-compose was fragile
// (YAML quoting) and raced the app on startup: the first tick usually hit a
// not-yet-ready server and the next attempt was 24 hours away. This script:
//   • waits for /api/health before doing anything,
//   • logs the status AND body of every task (a redirect used to look like 200),
//   • runs at a fixed local hour (CRON_HOUR, default 09:00),
//   • optionally runs once on startup (CRON_RUN_ON_START, default true) and
//     guards against running twice on the same calendar day.
//
// All endpoints authenticate with `Authorization: Bearer $CRON_SECRET`; the
// proxy lets those exact paths through without a NextAuth session.

const BASE_URL = (process.env.BOOKSHELF_URL || "http://app:3000").replace(/\/+$/, "");
const SECRET = process.env.CRON_SECRET;
const RUN_ON_START = process.env.CRON_RUN_ON_START !== "false";
const configuredHour = Number.parseInt(process.env.CRON_HOUR ?? "9", 10);
const RUN_HOUR = Number.isFinite(configuredHour) ? Math.min(23, Math.max(0, configuredHour)) : 9;
const INTERVAL_MINUTES = Math.min(60, Math.max(1, Number.parseInt(process.env.CRON_INTERVAL_MINUTES ?? "15", 10) || 15));
const TASK_TIMEOUT_MS = 20_000;
const HEALTH_TIMEOUT_MS = 5_000;
const HEALTH_ATTEMPTS = 30;
const HEALTH_DELAY_MS = 5_000;

const TASKS = [
  ["streak-remind", "/api/push/streak-remind"],
  ["overdue-remind", "/api/push/overdue-remind"],
  ["goal-progress", "/api/push/goal-progress"],
  ["backup", "/api/backup"],
  ["extensions", "/api/extensions/cron"],
  ["openlibrary-submissions", "/api/openlibrary/submissions"],
];
const FREQUENT_TASKS = TASKS.slice(0, 3);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function log(message) {
  console.log(`[cron ${new Date().toISOString()}] ${message}`);
}

async function waitForApp() {
  for (let attempt = 1; attempt <= HEALTH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`, {
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      });
      if (response.ok) {
        log(`app is ready (${BASE_URL})`);
        return true;
      }
      log(`health check returned ${response.status} (${attempt}/${HEALTH_ATTEMPTS})`);
    } catch (error) {
      log(`waiting for app (${attempt}/${HEALTH_ATTEMPTS}): ${error.message}`);
    }
    await sleep(HEALTH_DELAY_MS);
  }
  return false;
}

async function runTask(name, path) {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SECRET}` },
      redirect: "manual",
      signal: AbortSignal.timeout(TASK_TIMEOUT_MS),
    });
    const body = await response.text();
    log(`${name}: ${response.status} ${body.slice(0, 400)}`);
  } catch (error) {
    log(`${name} failed: ${error.message}`);
  }
}

let lastDailyDate = "";

async function runAll() {
  const today = new Date().toISOString().slice(0, 10);
  log("running frequent notification tasks");
  for (const [name, path] of FREQUENT_TASKS) {
    await runTask(name, path);
  }
  if (lastDailyDate !== today && new Date().getHours() >= RUN_HOUR) {
    for (const [name, path] of TASKS.slice(3)) await runTask(name, path);
    lastDailyDate = today;
  }
  log("scheduled tasks finished");
}

async function main() {
  if (!SECRET) {
    console.error("[cron] CRON_SECRET is not set — scheduled notifications and backups are disabled");
    process.exit(1);
  }

  if (!(await waitForApp())) {
    console.error("[cron] app did not become ready in time; exiting so Docker can retry");
    process.exit(1);
  }

  if (RUN_ON_START) await runAll();

  log(`running every ${INTERVAL_MINUTES} min; daily tasks after ${RUN_HOUR}:00 local`);
  setInterval(runAll, INTERVAL_MINUTES * 60 * 1000);
}

main().catch((error) => {
  console.error("[cron] fatal:", error);
  process.exit(1);
});

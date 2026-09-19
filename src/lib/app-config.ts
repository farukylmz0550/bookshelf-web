// SPDX-License-Identifier: GPL-3.0-only
// AppConfig (v3.0.0) — site-wide configuration from config.yaml.
// Resolution order: config.yaml values → code defaults.
// Replaces the v2.7.0 AppSettings DB row (removed in 3.0.0): the admin panel
// no longer changes these values; they are customized via config.yaml.
// Pure parsing/validation is separated so tests can exercise it directly.

import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

export type AppConfigValues = {
  /** Pages credited by one "I read N pages" click. */
  pagesPerReadEvent: number;
  xpBookAdded: number;
  xpBookFinishedBase: number;
  xpPagesPer10: number;
  xpLending: number;
  /** Base XP of the Fibonacci level curve. */
  xpPerLevelBase: number;
  /**
   * v3.1.0 — optional custom level names (index 0 = level 1); shown in
   * Stats/leaderboard/profile when present. Absent → i18n "Level N".
   */
  xpLevelNames: string[];
  /** "Fill missing page counts": Open Library lookup chunk size. */
  backfillChunkSize: number;
  /** Max ISBNs resolved per backfill button press. */
  backfillMaxBatch: number;
  /** v3.3.0 — XP awarded once when a seasonal challenge is completed. */
  challengeCompletionXp: number;
  /** Kobo eReader sync availability (Settings → Kobo Sync). */
  koboEnabled: boolean;
  /** Proxy unimplemented device requests to the real Kobo store. */
  koboStoreProxy: boolean;
  /** v3.4.0 — convert EPUB downloads to KEPUB (kepubify binary required). */
  koboKepubify: boolean;
};

const xpSchema = z.object({
  pagesPerReadEvent: intInRange(1, 1000).default(20),
  bookAdded: intInRange(1, 100000).default(5),
  bookFinishedBase: intInRange(1, 100000).default(50),
  pagesPer10: intInRange(1, 100000).default(3),
  lending: intInRange(1, 100000).default(5),
  levels: z
    .object({
      mode: z.enum(["fibonacci"]).default("fibonacci"),
      base: intInRange(1, 100000).default(100),
      names: z.array(z.string()).max(50).optional(),
    })
    .default({ mode: "fibonacci", base: 100 }),
});

const backfillSchema = z.object({
  chunkSize: intInRange(1, 100).default(20),
  maxBatch: intInRange(1, 200).default(40),
});

// v3.3.0 — seasonal challenges
const challengesSchema = z.object({
  completionXp: intInRange(0, 1000).default(25),
});

const koboSchema = z.object({
  enabled: z.boolean().default(true),
  storeProxy: z.boolean().default(true),
  kepubify: z.boolean().default(false),
});

const configSchema = z.object({
  xp: xpSchema.optional(),
  backfill: backfillSchema.optional(),
  challenges: challengesSchema.optional(),
  kobo: koboSchema.optional(),
});

function intInRange(min: number, max: number) {
  return z
    .number()
    .int()
    .transform((v) => Math.min(max, Math.max(min, Math.floor(v))));
}

/** Code defaults — identical to the legacy v2.7.0 defaults. */
export function defaultAppConfig(): AppConfigValues {
  return {
    pagesPerReadEvent: 20,
    xpBookAdded: 5,
    xpBookFinishedBase: 50,
    xpPagesPer10: 3,
    xpLending: 5,
    xpPerLevelBase: 100,
    xpLevelNames: [],
    backfillChunkSize: 20,
    backfillMaxBatch: 40,
    challengeCompletionXp: 25,
    koboEnabled: true,
    koboStoreProxy: true,
    koboKepubify: false,
  };
}

/**
 * Pure: validate an already-parsed YAML document into AppConfigValues.
 * Unknown/missing keys fall back to defaults; invalid types degrade
 * field-by-field to defaults (a bad value never breaks the app).
 */
export function validateAppConfig(doc: unknown): AppConfigValues {
  const defaults = defaultAppConfig();
  const parsed = configSchema.safeParse(doc ?? {});
  const data = parsed.success ? parsed.data : {};
  return {
    pagesPerReadEvent: data.xp?.pagesPerReadEvent ?? defaults.pagesPerReadEvent,
    xpBookAdded: data.xp?.bookAdded ?? defaults.xpBookAdded,
    xpBookFinishedBase: data.xp?.bookFinishedBase ?? defaults.xpBookFinishedBase,
    xpPagesPer10: data.xp?.pagesPer10 ?? defaults.xpPagesPer10,
    xpLending: data.xp?.lending ?? defaults.xpLending,
    xpPerLevelBase: data.xp?.levels?.base ?? defaults.xpPerLevelBase,
    xpLevelNames: Array.isArray(data.xp?.levels?.names)
      ? data.xp.levels.names
          .filter((n) => typeof n === "string" && n.trim().length > 0)
          .slice(0, 50)
          .map((n) => n.trim().slice(0, 60))
      : defaults.xpLevelNames,
    backfillChunkSize: data.backfill?.chunkSize ?? defaults.backfillChunkSize,
    backfillMaxBatch: data.backfill?.maxBatch ?? defaults.backfillMaxBatch,
    challengeCompletionXp: data.challenges?.completionXp ?? defaults.challengeCompletionXp,
    koboEnabled: data.kobo?.enabled ?? defaults.koboEnabled,
    koboStoreProxy: data.kobo?.storeProxy ?? defaults.koboStoreProxy,
    koboKepubify: data.kobo?.kepubify ?? defaults.koboKepubify,
  };
}

/** Pure: read + parse + validate a config.yaml file. Returns null if absent. */
export function readAppConfigFileSync(path: string): AppConfigValues | null {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  try {
    return validateAppConfig(parseYaml(raw));
  } catch {
    return null;
  }
}

const CONFIG_PATH = process.env.BOOKSHELF_CONFIG ?? "config.yaml";

// Short in-memory cache so actions don't re-read the file on every call.
const CACHE_TTL_MS = 60_000;
let cache: { values: AppConfigValues; at: number } | null = null;

/** Effective config: config.yaml → code defaults. Cached 60s. */
export async function getAppConfig(): Promise<AppConfigValues> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.values;
  const values = readAppConfigFileSync(CONFIG_PATH) ?? defaultAppConfig();
  cache = { values, at: Date.now() };
  return values;
}

/** Drop the in-memory cache (tests; file is re-read on next access). */
export function invalidateAppConfigCache() {
  cache = null;
}

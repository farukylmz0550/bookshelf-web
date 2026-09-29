// SPDX-License-Identifier: GPL-3.0-only
import { cookies } from "next/headers";

// v3.11.0 — "system" follows the OS prefers-color-scheme via a client-side
// no-flash script (the server cannot know the OS preference without a client
// hint). A missing/invalid cookie means "system" so fresh devices — e.g. a
// newly installed PWA — follow the OS instead of being pinned to light.
export type Theme = "light" | "dark" | "system";

const THEMES: Theme[] = ["light", "dark", "system"];

/** The raw stored value (cookie value or "system" default) — used by Settings. */
export async function getTheme(): Promise<Theme> {
  const cookieTheme = (await cookies()).get("theme")?.value;
  if (cookieTheme && THEMES.includes(cookieTheme as Theme)) {
    return cookieTheme as Theme;
  }
  return "system";
}

/**
 * The server-rendered theme: "light" | "dark" when pinned, undefined when the
 * cookie says "system" (or is absent) — the client script resolves the OS
 * preference before first paint.
 */
export async function getResolvedTheme(): Promise<"light" | "dark" | undefined> {
  const theme = await getTheme();
  return theme === "system" ? undefined : theme;
}

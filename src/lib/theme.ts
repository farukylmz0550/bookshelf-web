// SPDX-License-Identifier: GPL-3.0-only
import { cookies } from "next/headers";

export type Theme = "light" | "dark";

const THEMES: Theme[] = ["light", "dark"];

export async function getTheme(): Promise<Theme> {
  const cookieTheme = (await cookies()).get("theme")?.value;
  if (cookieTheme && THEMES.includes(cookieTheme as Theme)) {
    return cookieTheme as Theme;
  }
  return "light";
}

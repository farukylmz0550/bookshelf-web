// SPDX-License-Identifier: GPL-3.0-only
"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { Theme } from "@/lib/theme";
import { hasConsent } from "@/lib/cookies";

// v3.11.0 — "system" removes the pin: the cookie is deleted so getTheme()
// falls back to the system default (no flash, live OS-tracking script).
export async function setTheme(theme: Theme) {
  // Respect cookie consent — preferences category
  const allowed = await hasConsent("preferences");
  // If consent not yet given, still allow (implicit for essential UX) — but if explicitly rejected, skip cookie
  const raw = (await cookies()).get("cookie-consent")?.value;
  if (raw) {
    const parsed = (() => {
      try {
        return JSON.parse(raw) as { preferences?: boolean };
      } catch {
        return null;
      }
    })();
    if (parsed && parsed.preferences === false) {
      revalidatePath("/");
      return;
    }
  }
  // Early gate: if consent exists and preferences false, skip
  if (!allowed && raw) {
    revalidatePath("/");
    return;
  }

  if (theme === "system") {
    (await cookies()).delete("theme");
  } else {
    (await cookies()).set("theme", theme, {
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
  }
  revalidatePath("/");
}

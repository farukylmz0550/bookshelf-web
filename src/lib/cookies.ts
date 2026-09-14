// SPDX-License-Identifier: GPL-3.0-only
import { cookies } from "next/headers";
import { CONSENT_COOKIE, parseConsent, type ConsentCategory, type ConsentState } from "./cookies-shared";

export async function getConsent(): Promise<ConsentState | null> {
  const raw = (await cookies()).get(CONSENT_COOKIE)?.value;
  return parseConsent(raw);
}

export async function hasConsent(category: ConsentCategory): Promise<boolean> {
  if (category === "essential") return true;
  const consent = await getConsent();
  if (!consent) return false;
  return consent[category] === true;
}

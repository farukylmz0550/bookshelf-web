// SPDX-License-Identifier: GPL-3.0-only

// v2.10.0 — TOTP helpers shared by the login flow (auth.ts), the enrollment /
// disable actions and the admin danger zone. otplib defaults are
// Google-Authenticator compatible (SHA-1, 6 digits, 30 s period); a ±1 step
// tolerance keeps self-hosted instances with drifting clocks usable.

import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import { createHash } from "node:crypto";

const TOTP_ISSUER = "Book Shelf";

export type TotpVerifyResult = "VALID" | "INVALID";

export function createTotpSecret(): string {
  return generateSecret();
}

export async function totpEnrollmentPayload(secret: string, accountLabel: string) {
  const uri = generateURI({
    issuer: TOTP_ISSUER,
    label: accountLabel,
    secret,
  });
  const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
  return { uri, qrDataUrl };
}

export function verifyTotpCode(secret: string, token: string): TotpVerifyResult {
  const cleaned = (token ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return "INVALID";
  const result = verifySync({
    strategy: "totp",
    token: cleaned,
    secret,
    epochTolerance: [30, 30],
  });
  return result.valid ? "VALID" : "INVALID";
}

// One-way digest for comparing / storing token-like values (kept here so
// future token flows reuse one canonical hash).
export function hashSecretValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

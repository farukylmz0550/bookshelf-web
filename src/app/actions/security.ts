// SPDX-License-Identifier: GPL-3.0-only
"use server";

// v2.10.0 — TOTP two-factor enrollment/disable + forced password change.
// Every action authenticates via requireUserId() and touches only the
// caller's own row; TOTP verification attempts are rate limited per account.

import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { checkRateLimit, throttlingEnabled } from "@/lib/rate-limit";
import { createTotpSecret, totpEnrollmentPayload, verifyTotpCode } from "@/lib/totp";

export type TotpActionResult = { ok: true } | { ok: false; error: string };

const TOTP_ATTEMPTS = { max: 5, windowMs: 5 * 60 * 1000 };

function totpAllowed(userId: string): boolean {
  if (!throttlingEnabled()) return true;
  return checkRateLimit(`totp:${userId}`, TOTP_ATTEMPTS);
}

export async function getTotpStatus() {
  const userId = await requireUserId();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true, totpEnabled: true },
  });
  if (!user) return { ok: false as const, error: "NOT_FOUND" };
  return { ok: true as const, isAdmin: user.isAdmin, totpEnabled: user.totpEnabled };
}

export async function startTotpEnrollment(): Promise<
  { ok: true; qrDataUrl: string; secret: string } | { ok: false; error: string }
> {
  const userId = await requireUserId();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, isAdmin: true, totpEnabled: true },
  });
  if (!user) return { ok: false, error: "NOT_FOUND" };
  if (user.totpEnabled) return { ok: false, error: "ALREADY_ENABLED" };

  const secret = createTotpSecret();
  await db.user.update({ where: { id: userId }, data: { totpSecret: secret, totpEnabled: false } });
  const { qrDataUrl } = await totpEnrollmentPayload(secret, user.email);
  return { ok: true, qrDataUrl, secret };
}

export async function verifyTotpEnrollment(token: string): Promise<TotpActionResult> {
  const userId = await requireUserId();
  if (!totpAllowed(userId)) return { ok: false, error: "RATE_LIMITED" };
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpEnabled: true },
  });
  if (!user || !user.totpSecret) return { ok: false, error: "NOT_ENROLLED" };
  if (user.totpEnabled) return { ok: false, error: "ALREADY_ENABLED" };
  if (verifyTotpCode(user.totpSecret, token) !== "VALID") return { ok: false, error: "INVALID_CODE" };

  await db.user.update({ where: { id: userId }, data: { totpEnabled: true } });
  revalidatePath("/settings");
  revalidatePath("/(dashboard)");
  return { ok: true };
}

export async function disableTotp(token: string): Promise<TotpActionResult> {
  const userId = await requireUserId();
  if (!totpAllowed(userId)) return { ok: false, error: "RATE_LIMITED" };
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpEnabled: true, isAdmin: true },
  });
  if (!user) return { ok: false, error: "NOT_FOUND" };
  // v2.10.0 — TOTP is mandatory for admin accounts and cannot be disabled.
  if (user.isAdmin) return { ok: false, error: "ADMIN_REQUIRED" };
  if (!user.totpEnabled || !user.totpSecret) return { ok: false, error: "NOT_ENABLED" };
  if (verifyTotpCode(user.totpSecret, token) !== "VALID") return { ok: false, error: "INVALID_CODE" };

  await db.user.update({
    where: { id: userId },
    data: { totpSecret: null, totpEnabled: false },
  });
  revalidatePath("/settings");
  return { ok: true };
}

// Shared by the admin danger zone: fresh-code verification against the
// caller's own TOTP secret. Returns the failure code so callers can localize.
export async function verifyCallerTotp(token: string): Promise<TotpActionResult> {
  const userId = await requireUserId();
  if (!totpAllowed(userId)) return { ok: false, error: "RATE_LIMITED" };
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpEnabled: true },
  });
  if (!user || !user.totpEnabled || !user.totpSecret) return { ok: false, error: "NOT_ENABLED" };
  if (verifyTotpCode(user.totpSecret, token) !== "VALID") return { ok: false, error: "INVALID_CODE" };
  return { ok: true };
}

const forcedPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

// v2.10.0 — admin-assigned random password flow: the user logs in with the
// password handed over by the admin and must replace it before the app opens.
export async function completeForcedPasswordChange(input: { newPassword: string }): Promise<TotpActionResult> {
  const userId = await requireUserId();
  const parsed = forcedPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "INVALID_INPUT" };

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return { ok: false, error: "NOT_FOUND" };

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  });
  revalidatePath("/(dashboard)");
  return { ok: true };
}

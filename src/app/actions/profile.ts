// SPDX-License-Identifier: GPL-3.0-only
"use server";

// v3.16.0 — profile actions delegate to the shared users service for the
// profile name; password changes stay in the action layer because they verify
// the current password and are deliberately not part of the API/token surface.

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { updateProfileName as updateProfileNameService } from "@/lib/services/users";
import { checkRateLimit, throttlingEnabled } from "@/lib/rate-limit";
import { verifyTotpCode } from "@/lib/totp";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export async function updateProfileName(name: string) {
  const userId = await requireUserId();
  const result = await updateProfileNameService(userId, name);
  if (!result.ok) return { error: result.error };
  revalidatePath("/profile");
  revalidatePath("/(dashboard)");
  return { ok: true };
}

export async function changePassword(input: { currentPassword: string; newPassword: string }) {
  const userId = await requireUserId();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) return { error: "User not found" };

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return { error: "Current password is incorrect" };

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  });
  return { ok: true };
}

/**
 * Permanently deletes the authenticated user's account and all owned data.
 * Admin accounts are intentionally not eligible for self-deletion.
 */
export async function deleteOwnAccount(input: { password: string; totp?: string }) {
  const userId = await requireUserId();
  const parsed = z.object({ password: z.string().min(1), totp: z.string().optional() }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };

  if (throttlingEnabled() && !checkRateLimit(`account-delete:${userId}`, { max: 5, windowMs: 5 * 60 * 1000 })) {
    return { ok: false as const, error: "RATE_LIMITED" };
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, isAdmin: true, totpEnabled: true, totpSecret: true },
  });
  if (!user) return { ok: false as const, error: "NOT_FOUND" };
  if (user.isAdmin) return { ok: false as const, error: "ADMIN_CANNOT_DELETE" };
  if (!(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return { ok: false as const, error: "INVALID_PASSWORD" };
  }
  if (user.totpEnabled) {
    if (!user.totpSecret || verifyTotpCode(user.totpSecret, parsed.data.totp ?? "") !== "VALID") {
      return { ok: false as const, error: "INVALID_TOTP" };
    }
  }

  // Push subscriptions do not have a cascading relation in older databases.
  await db.$transaction(async (tx) => {
    await tx.pushSubscription.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });
  return { ok: true as const };
}

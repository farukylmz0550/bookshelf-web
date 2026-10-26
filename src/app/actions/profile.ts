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

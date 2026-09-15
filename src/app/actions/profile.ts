// SPDX-License-Identifier: GPL-3.0-only
"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { revalidatePath } from "next/cache";

const updateNameSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export async function updateProfileName(name: string) {
  const userId = await requireUserId();
  const parsed = updateNameSchema.safeParse({ name });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await db.user.update({
    where: { id: userId },
    data: { name: parsed.data.name.trim() },
  });
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
    // v2.10.0 — a normal change also clears the forced-change flag.
    data: { passwordHash, mustChangePassword: false },
  });

  return { ok: true };
}

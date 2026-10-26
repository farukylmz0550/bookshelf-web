// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — user/profile and admin user-management service.

import { z } from "zod";
import { db } from "@/lib/db";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
});

export async function getUserProfile(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      isAdmin: true,
      approved: true,
      xp: true,
      currentStreak: true,
      longestStreak: true,
      createdAt: true,
      _count: { select: { books: true } },
    },
  });
}

export async function updateProfileName(userId: string, name: string) {
  const parsed = updateProfileSchema.safeParse({ name });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await db.user.update({ where: { id: userId }, data: { name: parsed.data.name } });
  return { ok: true as const };
}

export async function listUsersForAdmin() {
  return db.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      isAdmin: true,
      approved: true,
      xp: true,
      createdAt: true,
      _count: { select: { books: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getUserForAdmin(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      isAdmin: true,
      approved: true,
      xp: true,
      createdAt: true,
      currentStreak: true,
      longestStreak: true,
      _count: { select: { books: true, persons: true, groups: true } },
    },
  });
}

export async function setUserApproved(adminId: string, userId: string, approved: boolean) {
  if (userId === adminId) throw new Error("Cannot change the approval status of your own account");
  const result = await db.user.updateMany({ where: { id: userId }, data: { approved } });
  return result.count > 0;
}

export async function toggleUserAdmin(adminId: string, userId: string) {
  if (userId === adminId) throw new Error("Cannot change your own admin role");
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { isAdmin: true } });
    if (user.isAdmin) {
      const adminCount = await tx.user.count({ where: { isAdmin: true } });
      if (adminCount <= 1) throw new Error("Cannot demote the last admin");
    }
    const updated = await tx.user.update({ where: { id: userId }, data: { isAdmin: !user.isAdmin } });
    return updated.isAdmin;
  });
}

export async function deleteUserForAdmin(adminId: string, userId: string) {
  if (userId === adminId) throw new Error("Cannot delete your own account");
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { isAdmin: true } });
    if (user.isAdmin) {
      const adminCount = await tx.user.count({ where: { isAdmin: true } });
      if (adminCount <= 1) throw new Error("Cannot delete the last admin");
    }
    await tx.pushSubscription.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });
}

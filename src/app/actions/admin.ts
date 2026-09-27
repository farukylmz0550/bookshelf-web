// SPDX-License-Identifier: GPL-3.0-only
"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { checkRateLimit, throttlingEnabled } from "@/lib/rate-limit";
import { verifyTotpCode } from "@/lib/totp";

export async function getUsers() {
  await requireAdmin();
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

// v3.5.1 — site-wide floor for the "I read N pages" step. 0 disables the
// floor; anything else lifts every user's effective step to at least this
// value (see src/lib/reading-settings.ts).
export async function getMinPagesPerReadEvent(): Promise<number> {
  await requireAdmin();
  const row = await db.siteSettings.findUnique({ where: { id: "site" } });
  return row?.minPagesPerReadEvent ?? 0;
}

export async function updateMinPagesPerReadEvent(value: number): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1000) {
    return { ok: false, error: "invalid" };
  }
  await db.siteSettings.upsert({
    where: { id: "site" },
    update: { minPagesPerReadEvent: parsed },
    create: { id: "site", minPagesPerReadEvent: parsed },
  });
  revalidatePath("/admin");
  revalidatePath("/settings");
  revalidatePath("/books");
  return { ok: true };
}

export async function approveUser(userId: string) {
  const adminId = await requireAdmin();
  if (userId === adminId) throw new Error("Cannot change the approval status of your own account");
  await db.user.update({ where: { id: userId }, data: { approved: true } });
  return { ok: true };
}

export async function rejectUser(userId: string) {
  const adminId = await requireAdmin();
  if (userId === adminId) throw new Error("Cannot change the approval status of your own account");
  await db.user.update({ where: { id: userId }, data: { approved: false } });
  return { ok: true };
}

export async function toggleAdmin(userId: string) {
  const adminId = await requireAdmin();
  if (userId === adminId) throw new Error("Cannot change your own admin role");
  // Atomic guard: the count check and the update run in one transaction so
  // two concurrent requests cannot both pass the last-admin check.
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { isAdmin: true } });
    if (user.isAdmin) {
      const adminCount = await tx.user.count({ where: { isAdmin: true } });
      if (adminCount <= 1) throw new Error("Cannot demote the last admin");
    }
    await tx.user.update({ where: { id: userId }, data: { isAdmin: !user.isAdmin } });
  });
  return { ok: true };
}

export async function deleteUser(userId: string) {
  const adminId = await requireAdmin();
  if (userId === adminId) throw new Error("Cannot delete your own account");
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { isAdmin: true } });
    if (user.isAdmin) {
      const adminCount = await tx.user.count({ where: { isAdmin: true } });
      if (adminCount <= 1) throw new Error("Cannot delete the last admin");
    }
    await tx.user.delete({ where: { id: userId } });
  });
  return { ok: true };
}

// v2.10.0 — password reset without an email channel: the admin assigns a
// random password (shown once) and the user is forced to replace it at next
// login via the mustChangePassword gate.
const RESET_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function generateRandomPassword(length = 12): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += RESET_ALPHABET[bytes[i] % RESET_ALPHABET.length];
  return out;
}

export async function adminResetPassword(
  userId: string,
  totpToken?: string,
): Promise<{ ok: true; password: string } | { ok: false; error: string }> {
  const adminId = await requireAdmin();
  const target = await db.user.findUnique({ where: { id: userId }, select: { id: true, isAdmin: true } });
  if (!target) return { ok: false, error: "NOT_FOUND" };
  // Other admins stay off-limits (no admin can reset another admin here);
  // resetting one's own account is allowed — the caller is an authenticated
  // admin, and TOTP-protected admins must supply a fresh code (v3.5.2).
  if (target.isAdmin && userId !== adminId) return { ok: false, error: "ADMIN_TARGET" };

  if (userId === adminId) {
    if (throttlingEnabled() && !checkRateLimit(`admin-self-reset:${adminId}`, { max: 5, windowMs: 5 * 60 * 1000 })) {
      return { ok: false, error: "RATE_LIMITED" };
    }
    const admin = await db.user.findUnique({
      where: { id: adminId },
      select: { totpSecret: true, totpEnabled: true },
    });
    if (admin?.totpEnabled && admin.totpSecret && verifyTotpCode(admin.totpSecret, totpToken ?? "") !== "VALID") {
      return { ok: false, error: "INVALID_TOTP" };
    }
  }

  const password = generateRandomPassword();
  const passwordHash = await bcrypt.hash(password, 12);
  await db.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: true } });
  return { ok: true, password };
}

// v2.10.0 — danger zone: delete every non-admin account and, through
// cascades, their books, shelves, memberships, lending records, goals,
// achievements and activity. Admin accounts, the achievement catalog and app
// settings survive. Guarded by the caller's fresh TOTP code.
export async function wipeNonAdminData(
  totpToken: string,
): Promise<{ ok: true; deletedUsers: number } | { ok: false; error: string }> {
  const adminId = await requireAdmin();
  const admin = await db.user.findUnique({ where: { id: adminId }, select: { totpSecret: true, totpEnabled: true } });
  if (!admin || !admin.totpEnabled || !admin.totpSecret) return { ok: false, error: "TOTP_NOT_ENABLED" };
  if (throttlingEnabled() && !checkRateLimit(`admin-wipe:${adminId}`, { max: 5, windowMs: 5 * 60 * 1000 })) {
    return { ok: false, error: "RATE_LIMITED" };
  }
  if (verifyTotpCode(admin.totpSecret, totpToken) !== "VALID") return { ok: false, error: "INVALID_TOTP" };

  const adminIds = (await db.user.findMany({ where: { isAdmin: true }, select: { id: true } })).map((u) => u.id);
  // PushSubscription has no FK cascade — clear non-admin subscriptions first.
  await db.pushSubscription.deleteMany({ where: { userId: { notIn: adminIds } } });
  const res = await db.user.deleteMany({ where: { isAdmin: false } });
  return { ok: true, deletedUsers: res.count };
}

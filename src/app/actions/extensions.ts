// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — extension actions (install/uninstall for user/admin).

"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  installExtension,
  uninstallExtension,
  setUserExtensionEnabled,
  setExtensionEnabled,
  setDefaultTheme,
  updateServerSettings,
  ExtensionError,
} from "@/lib/extensions/install";

async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isAdmin: true },
  });
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function uploadExtension(formData: FormData) {
  const user = await requireSession();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new ExtensionError("No file uploaded");
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await installExtension({ zip: buffer, userId: user.id, isAdmin: user.isAdmin });
  revalidatePath("/settings/extensions");
  revalidatePath("/admin/extensions");
  revalidatePath("/");
  return { ok: true, ...result };
}

export async function removeExtension(slug: string) {
  const user = await requireSession();
  await uninstallExtension({ slug, userId: user.id, isAdmin: user.isAdmin });
  revalidatePath("/settings/extensions");
  revalidatePath("/admin/extensions");
  revalidatePath("/");
  return { ok: true };
}

export async function toggleMyExtension(slug: string, enabled: boolean) {
  const user = await requireSession();
  await setUserExtensionEnabled(user.id, slug, enabled);
  revalidatePath("/settings/extensions");
  revalidatePath("/");
  return { ok: true };
}

export async function toggleExtension(slug: string, enabled: boolean) {
  const user = await requireSession();
  if (!user.isAdmin) throw new Error("Forbidden");
  await setExtensionEnabled(slug, enabled);
  revalidatePath("/admin/extensions");
  revalidatePath("/");
  return { ok: true };
}

export async function setServerDefaultTheme(slug: string | null) {
  const user = await requireSession();
  if (!user.isAdmin) throw new Error("Forbidden");
  await setDefaultTheme(slug);
  revalidatePath("/admin/extensions");
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true };
}

export async function saveServerExtensionSettings(slug: string, settings: Record<string, unknown>) {
  const user = await requireSession();
  if (!user.isAdmin) throw new Error("Forbidden");
  await updateServerSettings(slug, settings);
  revalidatePath("/admin/extensions");
  return { ok: true };
}

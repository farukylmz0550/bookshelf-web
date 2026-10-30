// SPDX-License-Identifier: GPL-3.0-only
"use server";

// v3.16.0 — shelf/group actions are thin adapters over the shared groups
// service; ownership checks and validation live there.

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/session";
import * as groups from "@/lib/services/groups";
import * as smartCollections from "@/lib/services/smart-collections";

type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateGroups(bookIds: string[] = []) {
  revalidatePath("/groups");
  revalidatePath("/books");
  for (const id of bookIds) revalidatePath(`/books/${id}`);
}

export async function createGroup(name: unknown, color?: unknown): Promise<ActionResult & { groupId?: string }> {
  const userId = await requireUserId();
  const result = await groups.createGroup(userId, name, color);
  if (!result.ok) return result;
  revalidateGroups();
  return result;
}

export async function renameGroup(groupId: string, name: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const result = await groups.renameGroup(userId, groupId, name);
  if (result.ok) revalidateGroups();
  return result;
}

export async function deleteGroup(groupId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const result = await groups.deleteGroup(userId, groupId);
  if (result.ok) revalidateGroups();
  return result;
}

export async function reorderGroups(orderedIds: string[]): Promise<ActionResult> {
  const userId = await requireUserId();
  const result = await groups.reorderGroups(userId, orderedIds);
  if (result.ok) revalidateGroups();
  return result;
}

export async function addBookToGroup(bookId: string, groupId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const result = await groups.addBookToGroup(userId, bookId, groupId);
  if (result.ok) revalidateGroups([bookId]);
  return result;
}

export async function listBooksForShelfPicker(groupId: string) {
  const userId = await requireUserId();
  return groups.listBooksForShelfPicker(userId, groupId);
}

export async function addBooksToGroup(groupId: string, bookIds: string[]) {
  const userId = await requireUserId();
  const result = await groups.addBooksToGroup(userId, groupId, bookIds);
  if (result.ok) revalidateGroups(bookIds);
  return result;
}

export async function removeBookFromGroup(bookId: string, groupId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const result = await groups.removeBookFromGroup(userId, bookId, groupId);
  if (result.ok) revalidateGroups([bookId]);
  return result;
}

export async function previewSmartCollection(rule: unknown) {
  return smartCollections.previewSmartCollection(await requireUserId(), rule);
}

export async function createSmartCollection(name: string, rule: unknown, color?: string | null) {
  const result = await smartCollections.createSmartCollection(await requireUserId(), name, rule, color);
  if (result.ok) revalidateGroups();
  return result;
}

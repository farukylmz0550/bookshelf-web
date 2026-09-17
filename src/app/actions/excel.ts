// SPDX-License-Identifier: GPL-3.0-only
"use server";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { buildExportWorkbook, buildTemplateWorkbook, readIsbnsFromBuffer } from "@/lib/books/excel";
import { lookupIsbns } from "@/lib/isbn";
import { awardXp, syncAchievements } from "@/lib/gamification";
import { getAppConfig } from "@/lib/app-config";

export async function exportLibraryExcel(): Promise<{ base64: string; filename: string }> {
  const userId = await requireUserId();
  const books = await db.book.findMany({ where: { userId } });
  const lends = await db.lendingRecord.findMany({
    where: { book: { userId }, returnedAt: null },
    select: { bookId: true, borrowerName: true, personName: true },
  });
  const map = new Map<string, string[]>();
  for (const r of lends) {
    const arr = map.get(r.bookId) ?? [];
    arr.push(r.personName ?? r.borrowerName);
    map.set(r.bookId, arr);
  }
  const wb = await buildExportWorkbook(books as never, map);
  const buffer = await wb.xlsx.writeBuffer();
  const base64 = Buffer.from(buffer as ArrayBuffer).toString("base64");
  return { base64, filename: "my_library.xlsx" };
}

export async function buildTemplateExcel(): Promise<{ base64: string; filename: string }> {
  const wb = await buildTemplateWorkbook();
  const buffer = await wb.xlsx.writeBuffer();
  const base64 = Buffer.from(buffer as ArrayBuffer).toString("base64");
  return { base64, filename: "isbn_list.xlsx" };
}

export async function importExcelFile(base64: string): Promise<{ imported: number; error?: string }> {
  const userId = await requireUserId();
  try {
    const buffer = Buffer.from(base64, "base64");
    const isbns = await readIsbnsFromBuffer(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
    );
    if (isbns.length === 0) return { imported: 0 };
    const found = await lookupIsbns(isbns);
    if (found.length === 0) return { imported: 0 };
    await db.book.createMany({
      data: found.map((b) => ({ userId, isbn: b.isbn, title: b.title, author: b.author, coverUrl: b.coverUrl })),
    });
    await awardXp(userId, found.length * (await getAppConfig()).xpBookAdded);
    await syncAchievements(userId);
    return { imported: found.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "FileTooLarge") return { imported: 0, error: "File too large (20MB limit)" };
    return { imported: 0, error: msg };
  }
}

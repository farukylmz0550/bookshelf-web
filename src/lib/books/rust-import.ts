// SPDX-License-Identifier: GPL-3.0-only
// Rust-backed CSV processing. The JS parser remains a development/fallback
// path so local installs do not need a Rust toolchain.
import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

type RustRow = {
  title: string;
  author: string | null;
  isbn: string | null;
  isbn13: string | null;
  rating: number;
  dateRead: string | null;
  tags: string[];
  notes: string | null;
  status: "TO_READ" | "READING" | "FINISHED" | null;
};

type RustResult = { rows: RustRow[]; invalidRows: string[] } | { error: string };

async function findBinary() {
  const configured = process.env.BOOKSHELF_READING_CORE_BIN;
  const candidates = [
    configured,
    "/usr/local/bin/reading-import",
    path.join(process.cwd(), "rust/reading_core/target/release/reading-import"),
    path.join(process.cwd(), "rust/reading_core/target/debug/reading-import"),
  ].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  return null;
}

function run(binary: string, input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, [], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `Rust import exited with code ${code ?? "unknown"}`));
    });
    child.stdin.end(input, "utf8");
  });
}

/** Returns null when the Rust binary is unavailable or rejects malformed output. */
export async function parseGoodreadsRowsWithRust(text: string): Promise<{
  rows: Array<{
    title: string;
    author?: string;
    isbn: string | null;
    isbn13: string | null;
    rating: number;
    dateRead: Date | null;
    tags: string[];
    notes: string | null;
    status: "TO_READ" | "READING" | "FINISHED" | null;
  }>;
  invalidRows: string[];
} | { error: string } | null> {
  const binary = await findBinary();
  if (!binary) return null;
  try {
    const parsed = JSON.parse(await run(binary, text)) as RustResult;
    if ("error" in parsed) return { error: "Invalid CSV — the file is malformed" };
    return {
      invalidRows: parsed.invalidRows,
      rows: parsed.rows.map((row) => ({
        ...row,
        author: row.author ?? undefined,
        dateRead: row.dateRead ? new Date(row.dateRead) : null,
      })),
    };
  } catch {
    return null;
  }
}

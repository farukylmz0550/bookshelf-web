// SPDX-License-Identifier: GPL-3.0-only
// v3.4.0 — kepubify cache-path derivation (pure parts only).
import { describe, it, expect } from "vitest";
import { kepubCacheDir, kepubCachePath, kepubSourceTmpPath } from "./kepub";

describe("kepubCacheDir", () => {
  it("derives the cache dir next to the sqlite file", () => {
    expect(kepubCacheDir("file:/data/bookshelf.db")).toBe("/data/cache/kepub");
    expect(kepubCacheDir("file:./prisma/dev.db")).toContain("/prisma/cache/kepub");
  });

  it("returns null for non-file URLs or missing input", () => {
    expect(kepubCacheDir("postgresql://host/db")).toBeNull();
    expect(kepubCacheDir(undefined)).toBeNull();
  });
});

describe("kepubCachePath", () => {
  it("is one .kepub.epub file per book id", () => {
    expect(kepubCachePath("/data/cache/kepub", "abc123")).toBe("/data/cache/kepub/abc123.kepub.epub");
  });
});

describe("kepubSourceTmpPath", () => {
  it("is unique per call (random suffix) and keeps the book id", () => {
    const a = kepubSourceTmpPath("/data/cache/kepub", "abc123");
    const b = kepubSourceTmpPath("/data/cache/kepub", "abc123");
    expect(a).not.toBe(b);
    expect(a.startsWith("/data/cache/kepub/abc123.src-")).toBe(true);
    expect(a.endsWith(".epub")).toBe(true);
  });
});

// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from "vitest";
import { isCronPath, isPublicPath } from "./public-paths";

describe("isPublicPath", () => {
  it("keeps unauthenticated API routes protected", () => {
    expect(isPublicPath("/api/books")).toBe(false);
    expect(isPublicPath("/api/push/subscribe")).toBe(false);
    expect(isPublicPath("/api/kobo")).toBe(false);
  });

  it("allows the device integrations and health probe", () => {
    expect(isPublicPath("/api/kobo/abc/v1/library")).toBe(true);
    expect(isPublicPath("/api/opds/abc/")).toBe(true);
    expect(isPublicPath("/api/health")).toBe(true);
  });

  it("allows exactly the scheduler endpoints, with or without a trailing slash", () => {
    expect(isPublicPath("/api/push/streak-remind")).toBe(true);
    expect(isPublicPath("/api/push/goal-progress")).toBe(true);
    expect(isPublicPath("/api/push/overdue-remind")).toBe(true);
    expect(isPublicPath("/api/backup")).toBe(true);
    expect(isPublicPath("/api/backup/")).toBe(true);
  });

  it("does not open sibling routes through the cron allowlist", () => {
    expect(isPublicPath("/api/push/subscribe")).toBe(false);
    expect(isPublicPath("/api/push/streak-remind/extra")).toBe(false);
    expect(isPublicPath("/api/backup/extra")).toBe(false);
  });
});

describe("isCronPath", () => {
  it("identifies scheduler endpoints only", () => {
    expect(isCronPath("/api/push/streak-remind")).toBe(true);
    expect(isCronPath("/api/backup")).toBe(true);
    expect(isCronPath("/api/push/subscribe")).toBe(false);
    expect(isCronPath("/api/health")).toBe(false);
  });
});

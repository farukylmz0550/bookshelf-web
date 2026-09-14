// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from "vitest";
import { dictionaries, LOCALES } from "./get-dictionary";

describe("dictionary parity", () => {
  it("groups block has identical key sets across all 6 languages (v2.8.0)", () => {
    const enKeys = Object.keys(dictionaries.en.groups).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(dictionaries[locale].groups).sort()).toEqual(enKeys);
    }
  });

  it("annual block has identical key sets across all 6 languages (R)", () => {
    const enKeys = Object.keys(dictionaries.en.annual).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(dictionaries[locale].annual).sort()).toEqual(enKeys);
    }
  });

  it("annual insights contain their placeholders in every language (R)", () => {
    for (const locale of LOCALES) {
      const a = dictionaries[locale].annual;
      expect(a.insightBooksMany).toContain("{count}");
      expect(a.insightPagesMany).toContain("{count}");
      expect(a.insightStreakMany).toContain("{count}");
      expect(a.insightMonth).toContain("{month}");
      expect(a.insightGenre).toContain("{genre}");
      expect(a.insightAuthor).toContain("{author}");
      expect(a.noReadingData).toContain("{year}");
    }
  });

  it("notify templates contain their placeholders with language-appropriate percent placement (R)", () => {
    for (const locale of LOCALES) {
      const n = dictionaries[locale].notify;
      expect(n.goalMonthStart).toContain("{target}");
      expect(n.goalProgressMid).toContain("{count}");
      expect(n.goalProgressMid).toContain("{percent}");
      expect(n.goalProgressFinal).toContain("{remaining}");
    }
    // Percent symbol placement is inside the template (localized), not the value:
    // Turkish places the sign first ("%60"), English after ("60%").
    expect(dictionaries.tr.notify.goalProgressMid).toContain("%{percent}");
    expect(dictionaries.en.notify.goalProgressMid).toContain("{percent}%");
  });

  it("books.status provides all three status labels in every language (v2.9.4 — React #31 regression)", () => {
    for (const locale of LOCALES) {
      const status = dictionaries[locale].books.status;
      expect(typeof status.TO_READ).toBe("string");
      expect(typeof status.READING).toBe("string");
      expect(typeof status.FINISHED).toBe("string");
      expect(status.TO_READ.length).toBeGreaterThan(0);
      expect(status.READING.length).toBeGreaterThan(0);
      expect(status.FINISHED.length).toBeGreaterThan(0);
    }
  });
});

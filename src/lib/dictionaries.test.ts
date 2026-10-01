// SPDX-License-Identifier: GPL-3.0-only
// v3.13.0 — dictionary parity: every supported locale must expose the exact
// same key set as en.json (Project_Rules §15 — a missing key silently breaks
// a whole language).

import { describe, it, expect } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import ar from "@/i18n/dictionaries/ar.json";
import { dictionaries, LOCALES } from "@/i18n/get-dictionary";

function flatten(obj: object, prefix = ""): Set<string> {
  const keys = new Set<string>();
  for (const [k, v] of Object.entries(obj)) {
    const path = `${prefix}${k}`;
    if (typeof v === "object" && v !== null) {
      for (const sub of flatten(v, `${path}.`)) keys.add(sub);
    } else {
      keys.add(path);
    }
  }
  return keys;
}

const EN = flatten(en);

describe("dictionary parity (v3.13.0)", () => {
  it("every locale registered in get-dictionary has a dictionary file", () => {
    expect(Object.keys(dictionaries).sort()).toEqual(LOCALES.slice().sort());
  });

  for (const locale of LOCALES) {
    it(`${locale}: same key set as en`, () => {
      const dict = dictionaries[locale];
      const localeKeys = flatten(dict);
      const missing = [...EN].filter((k) => !localeKeys.has(k));
      const extra = [...localeKeys].filter((k) => !EN.has(k));
      expect(missing).toEqual([]);
      expect(extra).toEqual([]);
    });

    it(`${locale}: every leaf value is a non-empty string`, () => {
      const walk = (node: unknown, path: string) => {
        if (typeof node === "object" && node !== null) {
          for (const [k, v] of Object.entries(node as object)) walk(v, `${path}${k}.`);
        } else {
          expect(typeof node === "string" && node.trim().length > 0, path).toBe(true);
        }
      };
      walk(dictionaries[locale], "");
    });
  }

  it("arabic: 600 keys — full parity with en (v3.15.0 adds groupExplore/groupMore/groupAccount, drops groupDiscover)", () => {
    expect(flatten(ar).size).toBe(600);
  });
});

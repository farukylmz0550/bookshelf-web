// SPDX-License-Identifier: GPL-3.0-only
import { cookies } from "next/headers";
import en from "./dictionaries/en.json";
import tr from "./dictionaries/tr.json";
import es from "./dictionaries/es.json";
import fr from "./dictionaries/fr.json";
import ru from "./dictionaries/ru.json";
import zh from "./dictionaries/zh.json";
import ar from "./dictionaries/ar.json";
import de from "./dictionaries/de.json";
import it from "./dictionaries/it.json";
import pt from "./dictionaries/pt.json";

function mergeDictionary(base: unknown, overrides: unknown): any {
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) return base;
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(overrides)) {
    result[key] = value && typeof value === "object" && !Array.isArray(value)
      ? mergeDictionary(result[key], value)
      : value;
  }
  return result;
}

export const dictionaries = {
  en,
  tr,
  es,
  fr,
  ru,
  zh,
  ar,
  de: mergeDictionary(en, de),
  it: mergeDictionary(en, it),
  pt: mergeDictionary(en, pt),
};
export type Locale = keyof typeof dictionaries;
export const LOCALES: Locale[] = ["en", "tr", "es", "fr", "ru", "zh", "ar", "de", "it", "pt"];

export async function getLocale(): Promise<Locale> {
  const cookieLocale = (await cookies()).get("locale")?.value;
  return cookieLocale && cookieLocale in dictionaries ? (cookieLocale as Locale) : "en";
}

export async function getDictionary() {
  return dictionaries[await getLocale()];
}

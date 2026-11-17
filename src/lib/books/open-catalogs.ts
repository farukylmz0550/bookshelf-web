// SPDX-License-Identifier: GPL-3.0-only

import type { IsbnLookupResult } from "@/lib/isbn";

const TIMEOUT_MS = 5000;
const MAX_BYTES = 2 * 1024 * 1024;
const USER_AGENT = "BookShelf/4.2.0 (open bibliographic lookup)";

type CatalogBook = IsbnLookupResult & { source: string };

function cleanIsbn(value: string) {
  return value.replace(/[^0-9Xx]/g, "");
}

function asText(value: unknown) {
  if (Array.isArray(value)) return value.map(String).join(", ");
  return typeof value === "string" ? value : undefined;
}

function decodeXml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function xmlValues(xml: string, tag: string) {
  const values: string[] = [];
  const expression = new RegExp(`<(?:[\\w.-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${tag}>`, "gi");
  for (const match of xml.matchAll(expression)) {
    const value = decodeXml(match[1]);
    if (value) values.push(value);
  }
  return values;
}

function join(values: string[]) {
  return [...new Set(values)].join(", ") || undefined;
}

export function parseDublinCoreCatalog(xml: string, isbn: string, source: string): CatalogBook | null {
  const record = xml.match(/<(?:[\w.-]+:)?record(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?record>/i)?.[1] ?? xml;
  const identifiers = xmlValues(record, "identifier");
  if (!identifiers.some((identifier) => cleanIsbn(identifier).includes(isbn))) return null;

  const title = xmlValues(record, "title")[0];
  if (!title) return null;

  return {
    isbn,
    title,
    author: join(xmlValues(record, "creator")),
    publishers: join(xmlValues(record, "publisher")),
    publishDate: xmlValues(record, "date")[0],
    languages: join(xmlValues(record, "language")),
    subjects: join(xmlValues(record, "subject").slice(0, 15)),
    isbn10: identifiers.map(cleanIsbn).find((value) => value.length === 10),
    isbn13: identifiers.map(cleanIsbn).find((value) => value.length === 13),
    source,
  };
}

function marcFields(record: string, tag: string) {
  const expression = new RegExp(`<datafield[^>]*tag=["']${tag}["'][^>]*>([\\s\\S]*?)<\\/datafield>`, "gi");
  return Array.from(record.matchAll(expression), (match) => match[1]);
}

function marcSubfields(fields: string[], code: string) {
  const values: string[] = [];
  const expression = new RegExp(`<subfield[^>]*code=["']${code}["'][^>]*>([\\s\\S]*?)<\\/subfield>`, "gi");
  for (const field of fields) {
    for (const match of field.matchAll(expression)) {
      const value = decodeXml(match[1]).replace(/[\s/:;,=]+$/, "");
      if (value) values.push(value);
    }
  }
  return values;
}

export function parseMarcCatalog(xml: string, isbn: string, source: string): CatalogBook | null {
  const record = xml.match(/<(?:[\w.-]+:)?record(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?record>/i)?.[1];
  if (!record) return null;

  const identifiers = marcSubfields(marcFields(record, "020"), "a");
  if (!identifiers.some((identifier) => cleanIsbn(identifier).includes(isbn))) return null;

  const titleFields = marcFields(record, "245");
  const title = [...marcSubfields(titleFields, "a"), ...marcSubfields(titleFields, "b")].join(": ");
  if (!title) return null;

  const publicationFields = [...marcFields(record, "264"), ...marcFields(record, "260")];
  return {
    isbn,
    title,
    author: join([...marcSubfields(marcFields(record, "100"), "a"), ...marcSubfields(marcFields(record, "700"), "a")]),
    publishers: join(marcSubfields(publicationFields, "b")),
    publishDate: marcSubfields(publicationFields, "c")[0],
    publishPlaces: join(marcSubfields(publicationFields, "a")),
    numberOfPages: marcSubfields(marcFields(record, "300"), "a")[0],
    languages: join(marcSubfields(marcFields(record, "041"), "a")),
    subjects: join(marcSubfields(marcFields(record, "650"), "a").slice(0, 15)),
    isbn10: identifiers.map(cleanIsbn).find((value) => value.length === 10),
    isbn13: identifiers.map(cleanIsbn).find((value) => value.length === 13),
    source,
  };
}

export function parseInternetArchiveCatalog(data: unknown, isbn: string): CatalogBook | null {
  const doc = (data as { response?: { docs?: Array<Record<string, unknown>> } })?.response?.docs?.[0];
  if (
    !doc ||
    !asText(doc.isbn)
      ?.split(/[,\s]+/)
      .some((value) => cleanIsbn(value) === isbn)
  )
    return null;
  const title = asText(doc.title);
  if (!title) return null;

  const identifier = asText(doc.identifier);
  const identifiers = Array.isArray(doc.isbn) ? doc.isbn.map(String) : [String(doc.isbn)];
  return {
    isbn,
    title,
    author: asText(doc.creator),
    publishers: asText(doc.publisher),
    publishDate: asText(doc.date)?.slice(0, 10),
    coverUrl: identifier ? `https://archive.org/services/img/${encodeURIComponent(identifier)}` : undefined,
    isbn10: identifiers.map(cleanIsbn).find((value) => value.length === 10),
    isbn13: identifiers.map(cleanIsbn).find((value) => value.length === 13),
    source: "Internet Archive",
  };
}

async function fetchPayload(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json, application/xml;q=0.9, text/xml;q=0.8", "User-Agent": USER_AGENT },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return null;
    const size = Number(response.headers.get("content-length") ?? 0);
    if (size > MAX_BYTES) return null;
    const text = await response.text();
    return text.length <= MAX_BYTES ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function sruUrl(base: string, query: string, recordSchema: string) {
  const url = new URL(base);
  url.searchParams.set("version", "1.2");
  url.searchParams.set("operation", "searchRetrieve");
  url.searchParams.set("query", query);
  url.searchParams.set("maximumRecords", "1");
  url.searchParams.set("recordSchema", recordSchema);
  return url;
}

async function fetchDublinCore(base: string, query: string, isbn: string, source: string) {
  const payload = await fetchPayload(sruUrl(base, query, "dc"));
  return payload ? parseDublinCoreCatalog(payload, isbn, source) : null;
}

async function fetchMarc(base: string, isbn: string, source: string) {
  const payload = await fetchPayload(sruUrl(base, `alma.isbn=${isbn}`, "marcxml"));
  return payload ? parseMarcCatalog(payload, isbn, source) : null;
}

async function fetchInternetArchive(isbn: string) {
  const url = new URL("https://archive.org/advancedsearch.php");
  url.searchParams.set("q", `isbn:${isbn}`);
  for (const field of ["identifier", "title", "creator", "publisher", "date", "isbn"]) {
    url.searchParams.append("fl[]", field);
  }
  url.searchParams.set("rows", "1");
  url.searchParams.set("output", "json");
  const payload = await fetchPayload(url);
  if (!payload) return null;
  try {
    return parseInternetArchiveCatalog(JSON.parse(payload), isbn);
  } catch {
    return null;
  }
}

/** Query open university/library catalogs in parallel after Open Library misses. */
export async function fetchBookFromOpenCatalogs(isbn: string): Promise<IsbnLookupResult | null> {
  const cleaned = cleanIsbn(isbn);
  const results = await Promise.all([
    fetchDublinCore("https://sru.finc.info/de15", `dc.identifier=${cleaned}`, cleaned, "Leipzig University Library"),
    fetchMarc("https://tau.alma.exlibrisgroup.com/view/sru/972TAU_INST", cleaned, "Tel Aviv University Libraries"),
    fetchMarc("https://rice.alma.exlibrisgroup.com/view/sru/01RICE_INST", cleaned, "Rice University Library"),
    fetchInternetArchive(cleaned),
  ]);
  return results.find((result): result is CatalogBook => result !== null) ?? null;
}

// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — server extension providers (declarative HTTP, HMAC signed).
//
// There is NO arbitrary server-side JS. Providers are described in manifest
// and invoked via allowlisted HTTP templates with signing; results are mapped
// through a simple key map (paths) to the app's existing shapes.

import { createHmac } from "node:crypto";
import { listServerExtensions } from "@/lib/extensions/install";
import type { ExtensionManifest } from "@/lib/extensions/manifest";

export function signPayload(secret: string | null, payload: string): string {
  if (!secret) return "";
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function applyPathMap(value: unknown, map?: Record<string, string>): unknown {
  if (!map || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => applyPathMap(item, map));
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // allow reverse mapping too
      let targetKey = k;
      for (const [from, to] of Object.entries(map)) {
        if (to === k) {
          targetKey = from;
          break;
        }
      }
      if (targetKey === k && map[k]) targetKey = map[k];
      result[targetKey] = applyPathMap(v, map);
    }
    return result;
  }
  return value;
}

function expandTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([^}]+)\}/g, (_, key) => {
    const value = vars[key] ?? vars[key.toLowerCase()] ?? "";
    return encodeURIComponent(value);
  });
}

export async function fetchMetadataFromProviders(isbn: string) {
  const extensions = await listServerExtensions();
  const cleaned = isbn.replace(/[^0-9Xx]/g, "");
  for (const ext of extensions) {
    const manifest = ext.manifest as ExtensionManifest;
    const providers = manifest.server?.metadataProviders ?? [];
    for (const provider of providers) {
      try {
        const url = expandTemplate(provider.urlTemplate, { isbn: cleaned, isbn13: cleaned, isbn10: cleaned });
        const headers: Record<string, string> = { Accept: "application/json", ...(provider.headers ?? {}) };
        const ts = String(Date.now());
        const signature = signPayload(ext.secret ?? null, `${ts}.${cleaned}`);
        if (ext.secret) {
          headers["X-Bookshelf-Signature"] = `sha256=${signature}`;
          headers["X-Bookshelf-Timestamp"] = ts;
          headers["X-Bookshelf-Extension"] = ext.slug;
        }
        const response = await fetch(url, { headers, cache: "no-store" });
        if (!response.ok) continue;
        const data = await response.json();
        const mapped = applyPathMap(data, provider.responseMap) as Record<string, unknown>;
        if (mapped && (mapped.title || mapped.isbn)) {
          return {
            isbn: String(mapped.isbn ?? cleaned),
            title: String(mapped.title ?? ""),
            author: mapped.author ? String(mapped.author) : undefined,
            coverUrl: mapped.coverUrl ? String(mapped.coverUrl) : undefined,
            numberOfPages: mapped.numberOfPages ? String(mapped.numberOfPages) : undefined,
            publishers: mapped.publishers ? String(mapped.publishers) : undefined,
            publishDate: mapped.publishDate ? String(mapped.publishDate) : undefined,
            publishPlaces: mapped.publishPlaces ? String(mapped.publishPlaces) : undefined,
            languages: mapped.languages ? String(mapped.languages) : undefined,
            subjects: mapped.subjects ? String(mapped.subjects) : undefined,
            isbn10: mapped.isbn10 ? String(mapped.isbn10) : undefined,
            isbn13: mapped.isbn13 ? String(mapped.isbn13) : undefined,
            source: provider.name,
          };
        }
      } catch {
        // Never let provider failures block lookup.
      }
    }
  }
  return null;
}

export async function fireNotificationWebhooks(event: string, payload: Record<string, unknown>) {
  const extensions = await listServerExtensions();
  const body = JSON.stringify({ event, payload, sentAt: new Date().toISOString() });
  for (const ext of extensions) {
    const manifest = ext.manifest as ExtensionManifest;
    const providers = manifest.server?.notificationProviders ?? [];
    for (const provider of providers) {
      if (provider.event !== event && provider.event !== "daily") continue;
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(provider.headers ?? {}),
        };
        const ts = String(Date.now());
        const signature = signPayload(ext.secret ?? null, body);
        if (ext.secret) {
          headers["X-Bookshelf-Signature"] = `sha256=${signature}`;
          headers["X-Bookshelf-Timestamp"] = ts;
          headers["X-Bookshelf-Extension"] = ext.slug;
        }
        await fetch(provider.webhook, { method: "POST", headers, body, cache: "no-store" }).catch(() => undefined);
      } catch {
        // Webhooks are best-effort.
      }
    }
  }
}

export async function runScheduledWebhooks() {
  // "daily" providers run on the extension cron tick.
  await fireNotificationWebhooks("daily", { triggeredAt: new Date().toISOString() });
}

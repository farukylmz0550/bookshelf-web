// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — extension manifest schema (declarative only).
//
// A package is a ZIP with a root manifest.json. Server extensions may only
// declare HTTP providers (metadata/import/notifications) and a schedule; there
// is no executable server-side JavaScript path anywhere in this platform.

import { z } from "zod";

export const EXTENSION_TYPES = ["theme", "ui", "server"] as const;
export type ExtensionType = (typeof EXTENSION_TYPES)[number];

export const UI_SLOTS = ["book-detail-tab", "books-widget", "sidebar-page"] as const;
export type UiSlot = (typeof UI_SLOTS)[number];

export const UI_PERMISSIONS = [
  "books.read",
  "books.write",
  "quotes.read",
  "quotes.write",
  "storage",
  "navigate",
] as const;
export type UiPermission = (typeof UI_PERMISSIONS)[number];

const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._\-/]+$/;

const safeRelativePath = z
  .string()
  .min(1)
  .max(200)
  .refine((value) => SAFE_PATH.test(value), "Unsafe asset path");

const colorValue = z
  .string()
  .max(120)
  .refine(
    (value) =>
      /^#[0-9a-fA-F]{3,8}$/.test(value) ||
      /^(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\([^;{}<>]+\)$/.test(value) ||
      /^[a-z]+$/i.test(value),
    "Invalid color token",
  );

// Only theme tokens that exist in globals.css are accepted. Font families are
// deliberately excluded: a theme must not load remote fonts.
const THEME_TOKEN_NAMES = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
  "surface",
  "surface-elevated",
  "border-strong",
  "accent-hover",
  "accent-active",
  "accent-soft",
  "error-soft",
  "error-text",
  "success",
  "success-soft",
  "success-text",
  "warning",
  "warning-soft",
  "warning-text",
  "info",
  "info-soft",
  "info-text",
  "selection",
  "selection-text",
  "disabled-surface",
  "disabled-text",
  "radius",
] as const;

const themeTokens = z.record(z.string(), colorValue).superRefine((tokens, ctx) => {
  for (const key of Object.keys(tokens)) {
    if (!(THEME_TOKEN_NAMES as readonly string[]).includes(key)) {
      ctx.addIssue({ code: "custom", message: `Unknown theme token: ${key}` });
    }
  }
});

const themeSchema = z
  .object({
    light: themeTokens.optional(),
    dark: themeTokens.optional(),
  })
  .refine((value) => Object.keys(value.light ?? {}).length + Object.keys(value.dark ?? {}).length > 0, {
    message: "A theme must define at least one light or dark token",
  });

const uiSlotSchema = z.object({
  slot: z.enum(UI_SLOTS),
  title: z.string().trim().min(1).max(100),
  entry: safeRelativePath,
});

const uiSchema = z.object({
  slots: z.array(uiSlotSchema).max(10).default([]),
  sidebarPage: z.object({ title: z.string().trim().min(1).max(100), entry: safeRelativePath }).optional(),
});

const metadataProviderSchema = z.object({
  name: z.string().trim().min(1).max(100),
  urlTemplate: z.string().url().max(2000),
  headers: z.record(z.string(), z.string().max(500)).optional(),
  responseMap: z.record(z.string(), z.string().max(200)).optional(),
});

const importProviderSchema = z.object({
  name: z.string().trim().min(1).max(100),
  urlTemplate: z.string().url().max(2000),
  headers: z.record(z.string(), z.string().max(500)).optional(),
  responseMap: z.record(z.string(), z.string().max(200)).optional(),
});

const notificationProviderSchema = z.object({
  name: z.string().trim().min(1).max(100),
  event: z.enum(["daily", "weekly", "monthly", "streak", "overdue", "goal"]),
  webhook: z.string().url().max(2000),
  headers: z.record(z.string(), z.string().max(500)).optional(),
});

const settingSchema = z.object({
  key: z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/),
  label: z.string().trim().min(1).max(100),
  type: z.enum(["string", "number", "boolean", "url"]).default("string"),
  required: z.boolean().default(false),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

const serverSchema = z.object({
  metadataProviders: z.array(metadataProviderSchema).max(10).default([]),
  importProviders: z.array(importProviderSchema).max(10).default([]),
  notificationProviders: z.array(notificationProviderSchema).max(10).default([]),
  settings: z.array(settingSchema).max(50).default([]),
});

export const manifestSchema = z.object({
  manifestVersion: z.literal(1),
  id: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, digits and dashes"),
  name: z.string().trim().min(1).max(100),
  version: z
    .string()
    .max(32)
    .regex(/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/, "Use a semver version like 1.0.0"),
  description: z.string().trim().max(1000).default(""),
  author: z.string().trim().max(100).default(""),
  type: z.enum(EXTENSION_TYPES),
  permissions: z.array(z.enum(UI_PERMISSIONS)).max(20).default([]),
  theme: themeSchema.optional(),
  ui: uiSchema.optional(),
  server: serverSchema.optional(),
});

export type ExtensionManifest = z.infer<typeof manifestSchema>;
export type ThemeTokens = { light: Record<string, string>; dark: Record<string, string> };

export class ManifestError extends Error {}

export function validateManifest(raw: unknown): ExtensionManifest {
  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ManifestError(`${issue.path.join(".") || "manifest"}: ${issue.message}`);
  }
  const manifest = parsed.data;
  if (manifest.type === "theme" && !manifest.theme) {
    throw new ManifestError("A theme extension must define a theme block");
  }
  if (manifest.type === "ui" && !manifest.ui) {
    throw new ManifestError("A UI extension must define a ui block");
  }
  if (manifest.type === "server" && !manifest.server) {
    throw new ManifestError("A server extension must define a server block");
  }
  if (manifest.type === "server" && manifest.permissions.length > 0) {
    throw new ManifestError("Server extensions are declarative and cannot request UI permissions");
  }
  return manifest;
}

export function parseManifestJson(text: string): ExtensionManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ManifestError("manifest.json is not valid JSON");
  }
  return validateManifest(raw);
}

export function themeTokensOf(manifest: ExtensionManifest): ThemeTokens {
  return { light: manifest.theme?.light ?? {}, dark: manifest.theme?.dark ?? {} };
}

export function hasPermission(manifest: ExtensionManifest, permission: UiPermission): boolean {
  return manifest.permissions.includes(permission);
}

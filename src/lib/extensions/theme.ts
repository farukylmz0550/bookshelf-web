// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — theme extensions: inject validated tokens for the active user.

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { themeTokensOf, type ExtensionManifest } from "@/lib/extensions/manifest";

export async function getActiveExtensionTheme(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  // Admin default takes precedence when explicitly set, else user choice.
  const [defaultTheme, userRow] = await Promise.all([
    db.extension.findFirst({
      where: { type: "THEME", isDefaultTheme: true, enabled: true },
      select: { manifest: true },
    }),
    db.extensionUser.findFirst({
      where: {
        userId: session.user.id,
        enabled: true,
        extension: { type: "THEME", enabled: true },
      },
      include: { extension: { select: { manifest: true } } },
      orderBy: { installedAt: "desc" },
    }),
  ]);

  const manifestRow = userRow?.extension.manifest ?? defaultTheme?.manifest;
  if (!manifestRow) return null;
  let manifest: ExtensionManifest;
  try {
    manifest = JSON.parse(manifestRow) as ExtensionManifest;
  } catch {
    return null;
  }
  const tokens = themeTokensOf(manifest);
  if (Object.keys(tokens.light).length === 0 && Object.keys(tokens.dark).length === 0) return null;

  const lines: string[] = [];
  if (Object.keys(tokens.light).length > 0) {
    lines.push(":root{");
    for (const [k, v] of Object.entries(tokens.light)) lines.push(`  --${k}: ${v};`);
    lines.push("}");
  }
  if (Object.keys(tokens.dark).length > 0) {
    lines.push(".dark{");
    for (const [k, v] of Object.entries(tokens.dark)) lines.push(`  --${k}: ${v};`);
    lines.push("}");
  }
  return lines.join("\n");
}

export function themeStyleTag(css: string | null): string | null {
  if (!css) return null;
  // No remote content; styles are embedded from validated tokens.
  return css.replace(/</g, "\\3c");
}

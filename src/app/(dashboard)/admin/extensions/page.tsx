// SPDX-License-Identifier: GPL-3.0-only
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getDictionary } from "@/i18n/get-dictionary";
import { listAllExtensionsForAdmin, getExtensionBySlug } from "@/lib/extensions/install";
import { AdminExtensionsManager } from "@/components/extensions/admin-extensions-manager";

export const metadata = { title: "Extensions" };

export default async function AdminExtensionsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!user?.isAdmin) redirect("/books");
  const dict = await getDictionary();
  const extensions = await listAllExtensionsForAdmin();
  const defaultTheme = await db.extension.findFirst({
    where: { type: "THEME", isDefaultTheme: true },
    select: { slug: true },
  });
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-[var(--font-serif)] text-2xl font-semibold tracking-tight text-foreground">
          {dict.extensions?.adminTitle ?? "Extensions"}
        </h1>
        <p className="font-[var(--font-sans)] text-sm text-muted-foreground">
          {dict.extensions?.adminSubtitle ?? "Manage themes, UI extensions and server extensions."}
        </p>
      </header>
      <AdminExtensionsManager
        extensions={extensions}
        defaultThemeSlug={defaultTheme?.slug ?? null}
        dict={dict.extensions ?? {}}
      />
    </div>
  );
}

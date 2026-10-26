// SPDX-License-Identifier: GPL-3.0-only
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getDictionary } from "@/i18n/get-dictionary";
import { listUserExtensionRows } from "@/lib/extensions/install";
import { ExtensionsManager } from "@/components/extensions/extensions-manager";

export const metadata = { title: "Extensions" };

export default async function ExtensionsSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const dict = await getDictionary();
  const extensions = await listUserExtensionRows(session.user.id);
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-[var(--font-serif)] text-2xl font-semibold tracking-tight text-foreground">
          {dict.extensions?.title ?? "Extensions"}
        </h1>
        <p className="font-[var(--font-sans)] text-sm text-muted-foreground">
          {dict.extensions?.subtitle ?? "Install themes and UI extensions."}
        </p>
      </header>
      <ExtensionsManager extensions={extensions} dict={dict.extensions ?? {}} />
    </div>
  );
}

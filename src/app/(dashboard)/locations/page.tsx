// SPDX-License-Identifier: GPL-3.0-only
import { getDictionary } from "@/i18n/get-dictionary";
import { requireUserId } from "@/lib/session";
import { listLocations } from "@/lib/services/locations";
import { LocationManager } from "./location-manager";

export default async function LocationsPage() {
  const userId = await requireUserId();
  const dict = await getDictionary();
  const locations = await listLocations(userId);
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-[var(--font-serif)] text-2xl font-semibold tracking-tight text-foreground">
          {dict.locations.title}
        </h1>
        <p className="text-sm text-muted-foreground">{dict.locations.description}</p>
      </header>
      <LocationManager locations={locations} dict={dict.locations} />
    </div>
  );
}

// SPDX-License-Identifier: GPL-3.0-only
import { getDictionary } from "@/i18n/get-dictionary";
import { requireUserId } from "@/lib/session";
import { listLocations } from "@/lib/services/locations";
import { listInventoryAudits } from "@/lib/services/inventory";
import { InventoryPanel } from "./panel";

export default async function InventoryPage() {
  const userId = await requireUserId();
  const dict = await getDictionary();
  const [locations, audits] = await Promise.all([listLocations(userId), listInventoryAudits(userId)]);
  return <InventoryPanel locations={locations} audits={audits} dict={dict.inventory} />;
}

// SPDX-License-Identifier: GPL-3.0-only
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { getDictionary } from "@/i18n/get-dictionary";
import { GroupsManager } from "./groups-manager";

export default async function GroupsPage() {
  const userId = await requireUserId();
  const dict = await getDictionary();

  const groups = await db.bookGroup.findMany({
    where: { userId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, color: true, order: true },
  });
  // Single grouped query — counts without N+1.
  const groupedCounts = await db.bookGroupMembership.groupBy({
    by: ["groupId"],
    where: { group: { userId } },
    _count: { groupId: true },
  });
  const counts = new Map(groupedCounts.map((c) => [c.groupId, c._count.groupId]));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-[var(--font-serif)] text-2xl font-semibold tracking-tight text-foreground">
          {dict.groups.title}
        </h1>
        <p className="font-[var(--font-sans)] text-sm text-muted-foreground">{dict.groups.subtitle}</p>
      </header>
      <GroupsManager
        groups={groups}
        counts={Object.fromEntries(counts)}
        dict={{
          ...dict.groups,
          booksLabel: dict.common.books,
          cancelLabel: dict.facts.cancel,
          saveLabel: dict.facts.save,
          searchLabel: dict.filter.search,
        }}
      />
    </div>
  );
}

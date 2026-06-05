import { getCachedSeriesDefinitions } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { buildSeriesConfigAdminRows, type SeriesConfigAdminRow } from "@/lib/series-config-resolve";

export async function getSeriesConfigAdminRows(): Promise<SeriesConfigAdminRow[]> {
  const definitions = await getCachedSeriesDefinitions();
  const userIds = [...new Set(definitions.map((c) => c.configuredById))];
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [];
  const configuredByNames = new Map(users.map((u) => [u.id, u.name]));

  const [reservationCounts, subcategoryCounts] = await Promise.all([
    prisma.serialReservation.groupBy({
      by: ["series"],
      _count: { _all: true },
    }),
    prisma.subcategory.groupBy({
      by: ["series"],
      where: { series: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const usageByCode = new Map<string, { reservationCount: number; subcategoryCount: number }>();
  for (const row of reservationCounts) {
    usageByCode.set(row.series, {
      reservationCount: row._count._all,
      subcategoryCount: 0,
    });
  }
  for (const row of subcategoryCounts) {
    if (!row.series) continue;
    const existing = usageByCode.get(row.series) ?? {
      reservationCount: 0,
      subcategoryCount: 0,
    };
    existing.subcategoryCount = row._count._all;
    usageByCode.set(row.series, existing);
  }

  return buildSeriesConfigAdminRows(definitions, configuredByNames, usageByCode);
}

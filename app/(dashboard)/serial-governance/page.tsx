import { Role } from "@prisma/client";

import { SerialGovernanceView } from "@/components/serial-governance/SerialGovernanceView";
import { parseSerialGovernancePageParams } from "@/lib/list-search-params";
import {
  getSerialActivity,
  getSerialGovernanceFilterOptions,
  getSeriesConfigsForAdvanced,
  getSeriesUsageSummary,
  getWarehouseSeriesSnapshot,
} from "@/lib/queries/serial";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SerialGovernancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = assertRole(await getRequestSession(), [...ACCESS.serialGovernance]);
  const sp = await searchParams;
  const parsed = parseSerialGovernancePageParams(sp);

  const activityFilters = {
    series: parsed.series || undefined,
    type: parsed.type || undefined,
    warehouseId: parsed.warehouseId || undefined,
    dateFrom: parsed.dateFrom || undefined,
    dateTo: parsed.dateTo || undefined,
    page: parsed.page,
    includeExactCount: parsed.includeExactCount,
  };

  const [filterOptions, usageSummary, warehouseSnapshots, activity, seriesConfigs] =
    await Promise.all([
      getSerialGovernanceFilterOptions(),
      getSeriesUsageSummary(),
      getWarehouseSeriesSnapshot({
        ensureWarehouseIds: user.warehouseId ? [user.warehouseId] : [],
      }),
      getSerialActivity(activityFilters),
      user.role === Role.OPS_HEAD ? getSeriesConfigsForAdvanced() : [],
    ]);

  return (
    <SerialGovernanceView
      role={user.role}
      initialTab={parsed.tab}
      usageSummary={usageSummary}
      activity={activity}
      warehouseSnapshots={warehouseSnapshots}
      seriesConfigs={seriesConfigs}
      filterOptions={filterOptions}
      filters={{
        series: parsed.series,
        type: parsed.type,
        warehouseId: parsed.warehouseId,
        dateFrom: parsed.dateFrom,
        dateTo: parsed.dateTo,
        page: parsed.page,
        batch: parsed.batch,
      }}
    />
  );
}

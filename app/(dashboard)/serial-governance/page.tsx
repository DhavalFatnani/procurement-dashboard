import { Role } from "@prisma/client";

import { SerialGovernanceView } from "@/components/serial-governance/SerialGovernanceView";
import { parseSerialGovernancePageParams } from "@/lib/list-search-params";
import { toPaginated } from "@/lib/pagination";
import type { SerialActivityRow } from "@/lib/serial-governance-types";
import {
  getSerialActivity,
  getSerialGovernanceFilterOptions,
  getSeriesConfigsForAdvanced,
  getSeriesUsageSummary,
  getWarehouseSeriesSnapshot,
} from "@/lib/queries/serial";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";
import { assignedWarehouseIds } from "@/lib/warehouse-scope";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SerialGovernancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = assertRole(await getRequestSession(), [...ACCESS.serialGovernance]);
  const sp = await searchParams;
  const parsed = parseSerialGovernancePageParams(sp);
  const tab = parsed.tab;

  const activityFilters = {
    series: parsed.series || undefined,
    type: parsed.type || undefined,
    warehouseId: parsed.warehouseId || undefined,
    dateFrom: parsed.dateFrom || undefined,
    dateTo: parsed.dateTo || undefined,
    page: parsed.page,
    includeExactCount: parsed.includeExactCount,
  };

  const filterOptions = await getSerialGovernanceFilterOptions();
  const emptyActivity = toPaginated<SerialActivityRow>([], 0, parsed.page, 25);

  let usageSummary: Awaited<ReturnType<typeof getSeriesUsageSummary>> = [];
  let warehouseSnapshots: Awaited<ReturnType<typeof getWarehouseSeriesSnapshot>> = [];
  let activity = emptyActivity;
  let seriesConfigs: Awaited<ReturnType<typeof getSeriesConfigsForAdvanced>> = [];

  if (tab === "summary") {
    usageSummary = await getSeriesUsageSummary();
  } else if (tab === "activity") {
    activity = await getSerialActivity(activityFilters);
    if (user.role === Role.OPS_HEAD) {
      seriesConfigs = await getSeriesConfigsForAdvanced();
    }
  } else if (tab === "warehouses") {
    warehouseSnapshots = await getWarehouseSeriesSnapshot({
      ensureWarehouseIds: assignedWarehouseIds(user),
    });
  }

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

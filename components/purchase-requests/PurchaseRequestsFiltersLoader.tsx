import { Role } from "@prisma/client";

import {
  PurchaseRequestsFiltersPanel,
  type PurchaseRequestsFilterOptions,
} from "@/components/purchase-requests/PurchaseRequestsListNav";
import type { PurchaseRequestsFiltersValue } from "@/components/purchase-requests/PurchaseRequestsFilters";
import { getListFilterOptions } from "@/lib/queries/purchase-requests";
import { timed } from "@/lib/server-timing";

export async function PurchaseRequestsFiltersLoader({
  role,
  filters,
}: {
  role: Role;
  filters: PurchaseRequestsFiltersValue;
}) {
  const filterOptions: PurchaseRequestsFilterOptions = await timed(
    "PR.filterOptions",
    () => getListFilterOptions(),
  );

  return (
    <PurchaseRequestsFiltersPanel
      role={role}
      filters={filters}
      filterOptions={filterOptions}
    />
  );
}

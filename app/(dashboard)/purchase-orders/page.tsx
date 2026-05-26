import { Suspense } from "react";

import { PurchaseOrdersView } from "@/components/purchase-orders/PurchaseOrdersView";
import { PageTableLoading } from "@/components/shared/PageTableLoading";
import { parsePurchaseOrderPageParams } from "@/lib/list-search-params";
import {
  AwaitingPRPanelLoader,
  showAwaitingPRPanel,
} from "@/components/purchase-orders/AwaitingPRPanelLoader";
import { getPOFilterOptions, getPurchaseOrders } from "@/lib/queries/purchase-orders";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession, type SessionUser } from "@/lib/session";
import { assignedWarehouseIds } from "@/lib/warehouse-scope";
import { dbParallel } from "@/lib/db-parallel";
import { timed } from "@/lib/server-timing";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = assertRole(await getRequestSession(), [...ACCESS.purchaseOrders]);
  const sp = await searchParams;
  const parsed = parsePurchaseOrderPageParams(sp);

  return (
    <Suspense
      fallback={<PageTableLoading columns={9} rows={10} />}
      key={`${parsed.status}-${parsed.vendorId}-${parsed.warehouseId}-${parsed.dateFrom}-${parsed.dateTo}-${parsed.page}`}
    >
      <PurchaseOrdersTableLoader user={user} parsed={parsed} fulfillPrId={parsed.fulfill} />
    </Suspense>
  );
}

async function PurchaseOrdersTableLoader({
  user,
  parsed,
  fulfillPrId,
}: {
  user: SessionUser;
  parsed: ReturnType<typeof parsePurchaseOrderPageParams>;
  fulfillPrId: string;
}) {
  const scopeWarehouseIds = assignedWarehouseIds(user);
  const [filterOptions, rows] = await dbParallel(
    () => timed("PO.filterOptions", () => getPOFilterOptions()),
    () =>
      timed("PO.getPurchaseOrders", () =>
        getPurchaseOrders({
          status: parsed.status || undefined,
          vendorId: parsed.vendorId || undefined,
          warehouseId: parsed.warehouseId || undefined,
          scopeWarehouseIds: scopeWarehouseIds.length > 0 ? scopeWarehouseIds : undefined,
          dateFrom: parsed.dateFrom || undefined,
          dateTo: parsed.dateTo || undefined,
          page: parsed.page,
          includeExactCount: parsed.includeExactCount,
        }),
      ),
  );

  const awaitingPanel = showAwaitingPRPanel(user.role) ? (
    <Suspense fallback={null}>
      <AwaitingPRPanelLoader fulfillPrId={fulfillPrId || undefined} />
    </Suspense>
  ) : null;

  return (
    <PurchaseOrdersView
      role={user.role}
      initialRows={rows}
      awaitingPanel={awaitingPanel}
      fulfillPrId={fulfillPrId || undefined}
      filterOptions={filterOptions}
      filters={{
        status: parsed.status,
        vendorId: parsed.vendorId,
        warehouseId: parsed.warehouseId,
        dateFrom: parsed.dateFrom,
        dateTo: parsed.dateTo,
      }}
    />
  );
}

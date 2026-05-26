import { Suspense } from "react";
import { Role } from "@prisma/client";

import { PurchaseOrdersView } from "@/components/purchase-orders/PurchaseOrdersView";
import { PageTableLoading } from "@/components/shared/PageTableLoading";
import { parsePurchaseOrderPageParams } from "@/lib/list-search-params";
import {
  getApprovedPRsAwaitingPO,
  getPOFilterOptions,
  getPurchaseOrders,
} from "@/lib/queries/purchase-orders";
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
  const [filterOptions, awaitingPRs, rows] = await dbParallel(
    () => timed("PO.filterOptions", () => getPOFilterOptions()),
    () =>
      user.role === Role.OPS_HEAD
        ? timed("PO.awaitingPRs", () => getApprovedPRsAwaitingPO())
        : Promise.resolve([]),
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

  return (
    <PurchaseOrdersView
      role={user.role}
      initialRows={rows}
      awaitingPRs={awaitingPRs}
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

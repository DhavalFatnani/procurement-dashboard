import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PurchaseOrdersView } from "@/components/purchase-orders/PurchaseOrdersView";
import { PageTableLoading } from "@/components/shared/PageTableLoading";
import { parsePurchaseOrderPageParams } from "@/lib/list-search-params";
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

  if (parsed.fulfill) {
    redirect(`/purchase-orders/configure/${encodeURIComponent(parsed.fulfill)}`);
  }

  return (
    <Suspense
      fallback={<PageTableLoading columns={9} rows={10} />}
      key={`${parsed.status}-${parsed.vendorId}-${parsed.warehouseId}-${parsed.prId}-${parsed.dateFrom}-${parsed.dateTo}-${parsed.page}`}
    >
      <PurchaseOrdersTableLoader user={user} parsed={parsed} />
    </Suspense>
  );
}

async function PurchaseOrdersTableLoader({
  user,
  parsed,
}: {
  user: SessionUser;
  parsed: ReturnType<typeof parsePurchaseOrderPageParams>;
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
          prId: parsed.prId || undefined,
          scopeWarehouseIds,
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
      filterOptions={filterOptions}
      filters={{
        status: parsed.status,
        vendorId: parsed.vendorId,
        warehouseId: parsed.warehouseId,
        prId: parsed.prId,
        dateFrom: parsed.dateFrom,
        dateTo: parsed.dateTo,
      }}
    />
  );
}

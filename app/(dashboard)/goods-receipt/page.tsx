import { Suspense } from "react";

import { GRNListView } from "@/components/goods-receipt/GRNListView";
import { PageTableLoading } from "@/components/shared/PageTableLoading";
import { parseGRNPageParams } from "@/lib/list-search-params";
import { getGRNFilterOptions, getGRNs } from "@/lib/queries/grn";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";
import { assignedWarehouseIds } from "@/lib/warehouse-scope";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function GoodsReceiptPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  assertRole(await getRequestSession(), [...ACCESS.goodsReceipt]);
  const sp = await searchParams;
  const parsed = parseGRNPageParams(sp);

  return (
    <Suspense
      fallback={<PageTableLoading columns={8} rows={10} />}
      key={`${parsed.poId}-${parsed.vendorId}-${parsed.dateFrom}-${parsed.dateTo}-${parsed.hasExceptions}-${parsed.page}`}
    >
      <GRNTableLoader parsed={parsed} />
    </Suspense>
  );
}

async function GRNTableLoader({
  parsed,
}: {
  parsed: ReturnType<typeof parseGRNPageParams>;
}) {
  const user = assertRole(await getRequestSession(), [...ACCESS.goodsReceipt]);
  const filterOptions = await getGRNFilterOptions();
  const rows = await getGRNs({
    poId: parsed.poId || undefined,
    vendorId: parsed.vendorId || undefined,
    dateFrom: parsed.dateFrom || undefined,
    dateTo: parsed.dateTo || undefined,
    hasExceptions:
      parsed.hasExceptions === "yes"
        ? true
        : parsed.hasExceptions === "no"
          ? false
          : undefined,
    scopeWarehouseIds: assignedWarehouseIds(user),
    page: parsed.page,
    includeExactCount: parsed.includeExactCount,
  });

  return (
    <GRNListView
      initialRows={rows}
      filterOptions={filterOptions}
      filters={{
        poId: parsed.poId,
        vendorId: parsed.vendorId,
        dateFrom: parsed.dateFrom,
        dateTo: parsed.dateTo,
        hasExceptions: parsed.hasExceptions,
      }}
    />
  );
}

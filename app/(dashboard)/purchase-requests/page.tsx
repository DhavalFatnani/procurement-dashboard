import { ExecutionType, PRStatus } from "@prisma/client";

import { getFilterOptions, getPurchaseRequests } from "@/app/actions/purchase-requests";
import { PurchaseRequestsView } from "@/components/purchase-requests/PurchaseRequestsView";
import { checkRole } from "@/lib/auth";
import { ACCESS } from "@/lib/route-access";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function parseStatuses(raw: string | string[] | undefined): PRStatus[] {
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return values.filter((v): v is PRStatus =>
    (Object.values(PRStatus) as string[]).includes(v),
  );
}

export default async function PurchaseRequestsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await checkRole([...ACCESS.purchaseRequests]);
  const sp = await searchParams;

  const statuses = parseStatuses(sp.status);
  const categoryId = typeof sp.categoryId === "string" ? sp.categoryId : "";
  const subcategoryId = typeof sp.subcategoryId === "string" ? sp.subcategoryId : "";
  const executionTypeRaw = typeof sp.executionType === "string" ? sp.executionType : "";
  const executionType =
    executionTypeRaw === ExecutionType.VENDOR_PURCHASE ||
    executionTypeRaw === ExecutionType.INTERNAL_PRINT
      ? executionTypeRaw
      : undefined;
  const warehouseId = typeof sp.warehouseId === "string" ? sp.warehouseId : "";
  const createdById = typeof sp.createdById === "string" ? sp.createdById : "";
  const dateFrom = typeof sp.dateFrom === "string" ? sp.dateFrom : "";
  const dateTo = typeof sp.dateTo === "string" ? sp.dateTo : "";
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : "1") || 1);

  const filterOptions = await getFilterOptions();
  const rows = await getPurchaseRequests({
    statuses: statuses.length ? statuses : undefined,
    categoryId: categoryId || undefined,
    subcategoryId: subcategoryId || undefined,
    executionType,
    warehouseId: warehouseId || undefined,
    createdById: createdById || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
  });

  return (
    <PurchaseRequestsView
      role={user.role}
      rows={rows}
      filterOptions={filterOptions}
      filters={{
        statuses,
        categoryId,
        subcategoryId,
        executionType: executionTypeRaw,
        warehouseId,
        createdById,
        dateFrom,
        dateTo,
      }}
    />
  );
}

import { Suspense } from "react";

import { PaymentRegisterView } from "@/components/payments/PaymentRegisterView";
import { PageTableLoading } from "@/components/shared/PageTableLoading";
import { dbParallel } from "@/lib/db-parallel";
import { parsePaymentRegisterPageParams } from "@/lib/list-search-params";
import { getPaymentFilterOptions, getPaymentRegister } from "@/lib/queries/payments";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession, type SessionUser } from "@/lib/session";
import { scopeWarehouseIdsForUser } from "@/lib/warehouse-scope";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PaymentRegisterPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = assertRole(await getRequestSession(), [...ACCESS.paymentRegister]);
  const sp = await searchParams;
  const parsed = parsePaymentRegisterPageParams(sp);

  return (
    <Suspense
      fallback={<PageTableLoading columns={9} rows={10} />}
      key={`${parsed.vendorId}-${parsed.poId}-${parsed.type}-${parsed.dateFrom}-${parsed.dateTo}-${parsed.page}`}
    >
      <PaymentRegisterTableLoader user={user} parsed={parsed} />
    </Suspense>
  );
}

async function PaymentRegisterTableLoader({
  user,
  parsed,
}: {
  user: SessionUser;
  parsed: ReturnType<typeof parsePaymentRegisterPageParams>;
}) {
  const scopeWarehouseIds = scopeWarehouseIdsForUser(user);
  const [filterOptions, rows] = await dbParallel(
    () => getPaymentFilterOptions(),
    () =>
      getPaymentRegister({
        vendorId: parsed.vendorId || undefined,
        poId: parsed.poId || undefined,
        type: parsed.type || undefined,
        dateFrom: parsed.dateFrom || undefined,
        dateTo: parsed.dateTo || undefined,
        page: parsed.page,
        includeExactCount: parsed.includeExactCount,
        scopeWarehouseIds,
      }),
  );

  return (
    <PaymentRegisterView
      initialRows={rows}
      filterOptions={filterOptions}
      filters={{
        vendorId: parsed.vendorId,
        poId: parsed.poId,
        type: parsed.type,
        dateFrom: parsed.dateFrom,
        dateTo: parsed.dateTo,
      }}
    />
  );
}

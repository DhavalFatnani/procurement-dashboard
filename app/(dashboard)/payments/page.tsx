import { Suspense } from "react";

import { PaymentsView } from "@/components/payments/PaymentsView";
import { PageTableLoading } from "@/components/shared/PageTableLoading";
import { dbParallel } from "@/lib/db-parallel";
import { parsePaymentPageParams } from "@/lib/list-search-params";
import { getPaymentFilterOptions, getPayments } from "@/lib/queries/payments";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession, type SessionUser } from "@/lib/session";
import { assignedWarehouseIds } from "@/lib/warehouse-scope";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = assertRole(await getRequestSession(), [...ACCESS.payments]);
  const sp = await searchParams;
  const parsed = parsePaymentPageParams(sp);

  return (
    <Suspense
      fallback={<PageTableLoading columns={10} rows={10} />}
      key={`${parsed.paymentStatus}-${parsed.matchStatus}-${parsed.vendorId}-${parsed.poId}-${parsed.dateFrom}-${parsed.dateTo}-${parsed.page}`}
    >
      <PaymentsTableLoader user={user} parsed={parsed} />
    </Suspense>
  );
}

async function PaymentsTableLoader({
  user,
  parsed,
}: {
  user: SessionUser;
  parsed: ReturnType<typeof parsePaymentPageParams>;
}) {
  const scopeWarehouseIds = assignedWarehouseIds(user);
  const [filterOptions, rows] = await dbParallel(
    () => getPaymentFilterOptions(),
    () =>
      getPayments({
        paymentStatus: parsed.paymentStatus || undefined,
        matchStatus: parsed.matchStatus || undefined,
        vendorId: parsed.vendorId || undefined,
        poId: parsed.poId || undefined,
        scopeWarehouseIds,
        dateFrom: parsed.dateFrom || undefined,
        dateTo: parsed.dateTo || undefined,
        page: parsed.page,
        includeExactCount: parsed.includeExactCount,
      }),
  );

  return (
    <PaymentsView
      role={user.role}
      initialRows={rows}
      filterOptions={filterOptions}
      initialInvoiceId={parsed.invoiceId || undefined}
      filters={{
        paymentStatus: parsed.paymentStatus,
        matchStatus: parsed.matchStatus,
        vendorId: parsed.vendorId,
        poId: parsed.poId,
        dateFrom: parsed.dateFrom,
        dateTo: parsed.dateTo,
      }}
    />
  );
}

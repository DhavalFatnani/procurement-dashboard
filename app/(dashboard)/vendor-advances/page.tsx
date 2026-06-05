import { Suspense } from "react";

import { AdvancePaymentsPanel } from "@/components/payments/AdvancePaymentsPanel";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageTableLoading } from "@/components/shared/PageTableLoading";
import { dbParallel } from "@/lib/db-parallel";
import { FINANCE_ROUTES } from "@/lib/finance-routes";
import { listBreadcrumbs } from "@/lib/lineage";
import { getAdvancePaymentHistory, getPendingAdvanceRequests } from "@/lib/queries/po-advance";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession, type SessionUser } from "@/lib/session";
import { scopeWarehouseIdsForUser } from "@/lib/warehouse-scope";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function VendorAdvancesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = assertRole(await getRequestSession(), [...ACCESS.vendorAdvances]);
  const sp = await searchParams;
  const advanceRequestId =
    typeof sp.advanceRequestId === "string" ? sp.advanceRequestId : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={listBreadcrumbs(FINANCE_ROUTES.vendorAdvances)}
        title="Vendor advances"
        subtitle="Review pending advance requests and fulfilled disbursements on purchase orders."
      />
      <Suspense fallback={<PageTableLoading columns={8} rows={8} />}>
        <VendorAdvancesLoader user={user} initialRequestId={advanceRequestId} />
      </Suspense>
    </div>
  );
}

async function VendorAdvancesLoader({
  user,
  initialRequestId,
}: {
  user: SessionUser;
  initialRequestId?: string;
}) {
  const scopeWarehouseIds = scopeWarehouseIdsForUser(user);
  const [advanceRows, advanceHistoryRows] = await dbParallel(
    () => getPendingAdvanceRequests(scopeWarehouseIds),
    () => getAdvancePaymentHistory(scopeWarehouseIds),
  );

  return (
    <AdvancePaymentsPanel
      role={user.role}
      rows={advanceRows}
      historyRows={advanceHistoryRows}
      initialRequestId={initialRequestId}
    />
  );
}

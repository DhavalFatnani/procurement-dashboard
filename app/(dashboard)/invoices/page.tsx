import { Suspense } from "react";
import { Role } from "@/lib/prisma-enums";
import { redirect } from "next/navigation";

import { InvoicesView } from "@/components/invoices/InvoicesView";
import { PageTableLoading } from "@/components/shared/PageTableLoading";
import { parseInvoicePageParams } from "@/lib/list-search-params";
import { getInvoiceFilterOptions, getInvoices } from "@/lib/queries/invoices";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession, type SessionUser } from "@/lib/session";
import { assignedWarehouseIds } from "@/lib/warehouse-scope";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = assertRole(await getRequestSession(), [...ACCESS.invoices]);
  if (user.role === Role.FINANCE) {
    redirect("/payments");
  }
  const sp = await searchParams;
  const parsed = parseInvoicePageParams(sp);

  return (
    <Suspense
      fallback={<PageTableLoading columns={9} rows={10} />}
      key={`${parsed.matchStatus}-${parsed.paymentStatus}-${parsed.vendorId}-${parsed.poId}-${parsed.dateFrom}-${parsed.dateTo}-${parsed.page}`}
    >
      <InvoicesTableLoader user={user} parsed={parsed} />
    </Suspense>
  );
}

async function InvoicesTableLoader({
  user,
  parsed,
}: {
  user: SessionUser;
  parsed: ReturnType<typeof parseInvoicePageParams>;
}) {
  const scopeWarehouseIds = assignedWarehouseIds(user);
  const filterOptions = await getInvoiceFilterOptions();
  const rows = await getInvoices({
    matchStatus: parsed.matchStatus || undefined,
    paymentStatus: parsed.paymentStatus || undefined,
    vendorId: parsed.vendorId || undefined,
    poId: parsed.poId || undefined,
    scopeWarehouseIds,
    dateFrom: parsed.dateFrom || undefined,
    dateTo: parsed.dateTo || undefined,
    uploadedById: user.role === Role.SM ? user.id : undefined,
    page: parsed.page,
    includeExactCount: parsed.includeExactCount,
  });

  return (
    <InvoicesView
      role={user.role}
      initialRows={rows}
      filterOptions={filterOptions}
      filters={{
        matchStatus: parsed.matchStatus,
        paymentStatus: parsed.paymentStatus,
        vendorId: parsed.vendorId,
        poId: parsed.poId,
        dateFrom: parsed.dateFrom,
        dateTo: parsed.dateTo,
      }}
    />
  );
}

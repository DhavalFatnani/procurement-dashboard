import { notFound } from "next/navigation";

import { InvoiceSettlementPageView } from "@/components/payments/InvoiceSettlementPageView";
import { getInvoicePaymentDetail } from "@/lib/queries/payments";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";
import { assertSessionInvoiceAccess } from "@/lib/warehouse-access";

type Params = Promise<{ invoiceId: string }>;

export default async function InvoiceSettlementDetailPage({
  params,
}: {
  params: Params;
}) {
  const user = assertRole(await getRequestSession(), [...ACCESS.vendorAdvances]);
  const { invoiceId } = await params;

  const access = await assertSessionInvoiceAccess(user, invoiceId);
  if (!access.ok) {
    notFound();
  }

  const detail = await getInvoicePaymentDetail(invoiceId);
  if (!detail) {
    notFound();
  }

  return <InvoiceSettlementPageView initialDetail={detail} />;
}

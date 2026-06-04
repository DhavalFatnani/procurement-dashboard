import { notFound } from "next/navigation";

import { CashPaymentDetailView } from "@/components/payments/CashPaymentDetailView";
import { getCashPaymentDetail } from "@/lib/queries/payments";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";

type Params = Promise<{ paymentId: string }>;

export default async function CashPaymentDetailPage({
  params,
}: {
  params: Params;
}) {
  assertRole(await getRequestSession(), [...ACCESS.paymentRegister]);
  const { paymentId } = await params;

  const detail = await getCashPaymentDetail(paymentId);
  if (!detail) {
    notFound();
  }

  return <CashPaymentDetailView detail={detail} />;
}

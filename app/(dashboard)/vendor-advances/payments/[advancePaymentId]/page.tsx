import { notFound } from "next/navigation";

import { AdvancePaymentDetailView } from "@/components/payments/AdvancePaymentDetailView";
import { getAdvancePaymentDetail } from "@/lib/queries/po-advance";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";

type Params = Promise<{ advancePaymentId: string }>;

export default async function AdvancePaymentDetailPage({
  params,
}: {
  params: Params;
}) {
  assertRole(await getRequestSession(), [...ACCESS.vendorAdvances]);
  const { advancePaymentId } = await params;

  const detail = await getAdvancePaymentDetail(advancePaymentId);
  if (!detail) {
    notFound();
  }

  return <AdvancePaymentDetailView detail={detail} />;
}

import { notFound } from "next/navigation";

import { AdvanceRequestDetailView } from "@/components/payments/AdvanceRequestDetailView";
import { getAdvanceRequestDetailPage } from "@/lib/queries/po-advance";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";
import { assertSessionPurchaseOrderAccess } from "@/lib/warehouse-access";

type Params = Promise<{ requestId: string }>;

export default async function AdvanceRequestDetailPage({
  params,
}: {
  params: Params;
}) {
  const user = assertRole(await getRequestSession(), [...ACCESS.vendorAdvances]);
  const { requestId } = await params;

  const detail = await getAdvanceRequestDetailPage(requestId);
  if (!detail) {
    notFound();
  }

  const access = await assertSessionPurchaseOrderAccess(user, detail.poId);
  if (!access.ok) {
    notFound();
  }

  return <AdvanceRequestDetailView detail={detail} />;
}

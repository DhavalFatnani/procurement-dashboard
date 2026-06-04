import { notFound } from "next/navigation";

import { AdvanceRequestDetailView } from "@/components/payments/AdvanceRequestDetailView";
import { getAdvanceRequestDetailPage } from "@/lib/queries/po-advance";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";

type Params = Promise<{ requestId: string }>;

export default async function AdvanceRequestDetailPage({
  params,
}: {
  params: Params;
}) {
  assertRole(await getRequestSession(), [...ACCESS.vendorAdvances]);
  const { requestId } = await params;

  const detail = await getAdvanceRequestDetailPage(requestId);
  if (!detail) {
    notFound();
  }

  return <AdvanceRequestDetailView detail={detail} />;
}

import { notFound } from "next/navigation";

import { AdvanceAllocationDetailView } from "@/components/payments/AdvanceAllocationDetailView";
import { getAdvanceAllocationDetail } from "@/lib/queries/payments";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";

type Params = Promise<{ allocationId: string }>;

export default async function AdvanceAllocationDetailPage({
  params,
}: {
  params: Params;
}) {
  assertRole(await getRequestSession(), [...ACCESS.paymentRegister]);
  const { allocationId } = await params;

  const detail = await getAdvanceAllocationDetail(allocationId);
  if (!detail) {
    notFound();
  }

  return <AdvanceAllocationDetailView detail={detail} />;
}

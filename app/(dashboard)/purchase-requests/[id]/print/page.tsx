import { notFound, redirect } from "next/navigation";

import { getSerialReservationByPRId } from "@/app/actions/serial";
import { PrintExecutionView } from "@/components/purchase-requests/PrintExecutionView";
import { checkRole } from "@/lib/auth";
import { ACCESS } from "@/lib/route-access";

type Params = Promise<{ id: string }>;

export default async function PrintExecutionPage({ params }: { params: Params }) {
  await checkRole([...ACCESS.purchaseRequests]);
  const { id } = await params;

  const reservation = await getSerialReservationByPRId(id);
  if (!reservation) {
    redirect(`/purchase-requests/${id}`);
  }

  if (reservation.prId !== id) {
    notFound();
  }

  return <PrintExecutionView prId={id} reservation={reservation} />;
}

import { Role } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { getSerialReservationByPRId } from "@/app/actions/serial";
import { PrintExecutionView } from "@/components/purchase-requests/PrintExecutionView";
import { SMPrintSummaryView } from "@/components/purchase-requests/SMPrintSummaryView";
import { checkRole } from "@/lib/auth";
import { ACCESS } from "@/lib/route-access";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ fresh?: string }>;

export default async function PrintExecutionPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const user = await checkRole([...ACCESS.purchaseRequests]);
  const { id } = await params;
  const { fresh } = await searchParams;

  const reservation = await getSerialReservationByPRId(id);
  if (!reservation) {
    redirect(`/purchase-requests/${id}`);
  }

  if (reservation.prId !== id) {
    notFound();
  }

  if (user.role === Role.SM) {
    return (
      <SMPrintSummaryView
        prId={id}
        reservation={reservation}
        autoPrint={fresh === "1"}
      />
    );
  }

  return <PrintExecutionView prId={id} reservation={reservation} />;
}

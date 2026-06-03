import { notFound } from "next/navigation";

import { PODetailPageShell } from "@/components/purchase-orders/PODetailPageShell";
import { getPOByIdForPage } from "@/lib/queries/purchase-orders";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";

type Params = Promise<{ id: string }>;

/** PO detail loads a heavy Prisma graph; allow headroom on serverless. */
export const maxDuration = 60;

export default async function PurchaseOrderDetailPage({ params }: { params: Params }) {
  const user = assertRole(await getRequestSession(), [...ACCESS.purchaseOrders]);
  const { id } = await params;

  const po = await getPOByIdForPage(user, id);
  if (!po) {
    notFound();
  }

  return <PODetailPageShell po={po} role={user.role} />;
}

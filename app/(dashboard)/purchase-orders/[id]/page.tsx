import { notFound } from "next/navigation";

import { PODetailPageShell } from "@/components/purchase-orders/PODetailPageShell";
import { getPOById } from "@/lib/queries/purchase-orders";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";
import { assertSessionPurchaseOrderAccess } from "@/lib/warehouse-access";

type Params = Promise<{ id: string }>;

export default async function PurchaseOrderDetailPage({ params }: { params: Params }) {
  const user = assertRole(await getRequestSession(), [...ACCESS.purchaseOrders]);
  const { id } = await params;

  const access = await assertSessionPurchaseOrderAccess(user, id);
  if (!access.ok) {
    notFound();
  }

  const po = await getPOById(id);
  if (!po) {
    notFound();
  }

  return <PODetailPageShell po={po} role={user.role} />;
}

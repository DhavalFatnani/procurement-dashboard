import { PendingConfigurePOListView } from "@/components/purchase-orders/PendingConfigurePOListView";
import { assertConfigurePOAccess } from "@/lib/configure-po-access";
import { getApprovedPRsAwaitingPO } from "@/lib/queries/purchase-orders";
import { scopeWarehouseIdsForUser } from "@/lib/warehouse-scope";

export default async function ConfigurePurchaseOrdersPage() {
  const user = await assertConfigurePOAccess();
  const scopeWarehouseIds = scopeWarehouseIdsForUser(user);
  const rows = await getApprovedPRsAwaitingPO({ scopeWarehouseIds });

  return <PendingConfigurePOListView rows={rows} />;
}

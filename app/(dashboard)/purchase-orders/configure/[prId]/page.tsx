import { ConfigurePONotAvailable, ConfigurePOFromPRView } from "@/components/purchase-orders/ConfigurePOFromPRView";
import { assertConfigurePOAccess } from "@/lib/configure-po-access";
import { dbParallel } from "@/lib/db-parallel";
import {
  getApprovedPRAwaitingPOById,
  getPOFilterOptions,
} from "@/lib/queries/purchase-orders";
import { assignedWarehouseIds } from "@/lib/warehouse-scope";

type Params = Promise<{ prId: string }>;

export default async function ConfigurePurchaseOrderPage({ params }: { params: Params }) {
  const user = await assertConfigurePOAccess();
  const { prId: prIdRaw } = await params;
  const prId = prIdRaw.trim();
  const scopeWarehouseIds = assignedWarehouseIds(user);

  const [selectedPr, filterOptions] = await dbParallel(
    () => getApprovedPRAwaitingPOById(prId, { scopeWarehouseIds }),
    () => getPOFilterOptions(),
  );

  if (!selectedPr) {
    return <ConfigurePONotAvailable />;
  }

  return (
    <ConfigurePOFromPRView pr={selectedPr} activeVendors={filterOptions.vendors} />
  );
}

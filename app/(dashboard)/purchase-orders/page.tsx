import { ModulePlaceholder } from "@/components/shared/ModulePlaceholder";
import { checkRole } from "@/lib/auth";
import { ACCESS } from "@/lib/route-access";

export default async function PurchaseOrdersPage() {
  await checkRole([...ACCESS.purchaseOrders]);

  return (
    <ModulePlaceholder
      title="Purchase orders"
      subtitle="PO lifecycle, reconciliation, and closure — wired in Phase 3."
    />
  );
}

import Link from "next/link";

import { CreatePRForm } from "@/components/purchase-requests/CreatePRForm";
import { PageHeader } from "@/components/shared/PageHeader";
import { dbParallel } from "@/lib/db-parallel";
import { getFilterOptions } from "@/lib/queries/purchase-requests";
import { getWarehousesAssignedToUser } from "@/lib/queries/warehouses";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function NewPurchaseRequestPage() {
  const user = assertRole(await getRequestSession(), [...ACCESS.purchaseRequests]);

  const [assignedWarehouses, filterOptions] = await dbParallel(
    () => getWarehousesAssignedToUser(user.id),
    () => getFilterOptions(),
  );

  if (assignedWarehouses.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="Create purchase request" />
        <p className="text-ds-sm text-muted-foreground">
          Your account has no warehouse assigned. Ask Ops Head to link your user to a warehouse,
          then try again.
        </p>
        <Link href="/purchase-requests" className={cn(buttonVariants({ variant: "outline" }))}>
          Back to purchase requests
        </Link>
      </div>
    );
  }

  return (
    <CreatePRForm
      categories={filterOptions.categories}
      subcategories={filterOptions.subcategories}
      warehouses={assignedWarehouses}
      defaultWarehouseId={assignedWarehouses[0]!.id}
    />
  );
}

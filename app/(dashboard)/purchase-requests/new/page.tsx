import Link from "next/link";

import { Suspense } from "react";

import { CreatePRForm } from "@/components/purchase-requests/CreatePRForm";
import { PageHeader } from "@/components/shared/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { hasGlobalWarehouseScope, isCentralOpsOrAbove } from "@/lib/admin-access";
import { dbParallel } from "@/lib/db-parallel";
import { getFilterOptions } from "@/lib/queries/purchase-requests";
import { getWarehouseOptions, getWarehousesAssignedToUser } from "@/lib/queries/warehouses";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export default async function NewPurchaseRequestPage() {
  const user = assertRole(await getRequestSession(), [...ACCESS.purchaseRequests]);

  const [warehouses, filterOptions] = await dbParallel(
    () =>
      hasGlobalWarehouseScope(user.role)
        ? getWarehouseOptions()
        : getWarehousesAssignedToUser(user.id),
    () => getFilterOptions(),
  );

  if (warehouses.length === 0) {
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
    <Suspense fallback={<p className="text-ds-sm text-muted-foreground">Loading…</p>}>
      <CreatePRForm
        role={user.role}
        categories={filterOptions.categories}
        subcategories={filterOptions.subcategories}
        catalogItems={filterOptions.catalogItems}
        warehouses={warehouses}
        defaultWarehouseId={isCentralOpsOrAbove(user.role) ? "" : warehouses[0]!.id}
      />
    </Suspense>
  );
}

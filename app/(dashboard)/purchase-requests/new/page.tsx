import Link from "next/link";

import { CreatePRForm } from "@/components/purchase-requests/CreatePRForm";
import { PageHeader } from "@/components/shared/PageHeader";
import { dbParallel } from "@/lib/db-parallel";
import { getFilterOptions } from "@/lib/queries/purchase-requests";
import { prisma } from "@/lib/prisma";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function NewPurchaseRequestPage() {
  const user = assertRole(await getRequestSession(), [...ACCESS.purchaseRequests]);

  if (!user.warehouseId) {
    return (
      <div className="space-y-4">
        <PageHeader title="Create purchase request" />
        <p className="text-ds-sm text-muted-foreground">
          Your account has no warehouse assigned. Ask Ops Head to link your user to a warehouse
          in the database, then try again.
        </p>
        <Link href="/purchase-requests" className={cn(buttonVariants({ variant: "outline" }))}>
          Back to purchase requests
        </Link>
      </div>
    );
  }

  const [warehouse, filterOptions] = await dbParallel(
    () =>
      prisma.warehouse.findUnique({
        where: { id: user.warehouseId! },
        select: { id: true, name: true },
      }),
    () => getFilterOptions(),
  );

  if (!warehouse) {
    return (
      <div className="space-y-4">
        <PageHeader title="Create purchase request" />
        <p className="text-ds-sm text-muted-foreground">
          The warehouse on your profile could not be loaded. Contact Ops Head to fix your account
          setup.
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
      warehouseId={warehouse.id}
      warehouseName={warehouse.name}
    />
  );
}

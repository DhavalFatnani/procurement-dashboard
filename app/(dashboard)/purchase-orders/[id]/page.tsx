import Link from "next/link";

import { ModulePlaceholder } from "@/components/shared/ModulePlaceholder";
import { checkRole } from "@/lib/auth";
import { ACCESS } from "@/lib/route-access";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Params = Promise<{ id: string }>;

export default async function PurchaseOrderDetailPage({ params }: { params: Params }) {
  await checkRole([...ACCESS.purchaseOrders]);
  const { id } = await params;

  return (
    <ModulePlaceholder
      title={`Purchase order ${id}`}
      subtitle="PO reconciliation and GRN panels ship in Phase 3."
      action={
        <Link href="/purchase-orders" className={cn(buttonVariants({ variant: "outline" }))}>
          Back to list
        </Link>
      }
    />
  );
}

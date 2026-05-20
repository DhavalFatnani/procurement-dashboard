import { notFound } from "next/navigation";

import { getFilterOptions } from "@/app/actions/purchase-requests";
import { getActiveVendors } from "@/app/actions/vendors";
import { CreatePRForm } from "@/components/purchase-requests/CreatePRForm";
import { checkRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACCESS } from "@/lib/route-access";

export default async function NewPurchaseRequestPage() {
  const user = await checkRole([...ACCESS.purchaseRequests]);

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { warehouse: { select: { id: true, name: true } } },
  });
  if (!dbUser?.warehouse) {
    notFound();
  }

  const filterOptions = await getFilterOptions();
  const activeVendors = await getActiveVendors();

  return (
    <CreatePRForm
      categories={filterOptions.categories}
      subcategories={filterOptions.subcategories}
      activeVendors={activeVendors}
      warehouseId={dbUser.warehouse.id}
      warehouseName={dbUser.warehouse.name}
    />
  );
}

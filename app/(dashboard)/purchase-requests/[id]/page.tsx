import { notFound } from "next/navigation";

import { getFilterOptions, getPRById } from "@/app/actions/purchase-requests";
import { getActiveVendors } from "@/app/actions/vendors";
import { PRDetailView } from "@/components/purchase-requests/PRDetailView";
import { checkRole } from "@/lib/auth";
import { ACCESS } from "@/lib/route-access";

type Params = Promise<{ id: string }>;

export default async function PurchaseRequestDetailPage({ params }: { params: Params }) {
  const user = await checkRole([...ACCESS.purchaseRequests]);
  const { id } = await params;

  const pr = await getPRById(id);
  const filterOptions = await getFilterOptions();
  const activeVendors = await getActiveVendors();

  if (!pr) {
    notFound();
  }

  return (
    <PRDetailView
      pr={pr}
      role={user.role}
      categories={filterOptions.categories}
      subcategories={filterOptions.subcategories}
      activeVendors={activeVendors}
    />
  );
}

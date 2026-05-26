import { notFound } from "next/navigation";

import {
  PRDetailPrintSection,
  PRDetailProgress,
  PRDetailVersionHistory,
} from "@/components/purchase-requests/PRDetailSections";
import { PRDetailPageShell } from "@/components/purchase-requests/PRDetailPageShell";
import { dbParallel } from "@/lib/db-parallel";
import { getFilterOptions, getPRById } from "@/lib/queries/purchase-requests";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";

type Params = Promise<{ id: string }>;

export default async function PurchaseRequestDetailPage({ params }: { params: Params }) {
  const user = assertRole(await getRequestSession(), [...ACCESS.purchaseRequests]);
  const { id } = await params;

  const [pr, filterOptions] = await dbParallel(
    () => getPRById(user, id),
    () => getFilterOptions(),
  );

  if (!pr) {
    notFound();
  }

  return (
    <PRDetailPageShell
      pr={pr}
      role={user.role}
      categories={filterOptions.categories}
      subcategories={filterOptions.subcategories}
      progressSlot={<PRDetailProgress pr={pr} />}
      printSlot={<PRDetailPrintSection pr={pr} />}
      versionHistorySlot={<PRDetailVersionHistory pr={pr} />}
    />
  );
}

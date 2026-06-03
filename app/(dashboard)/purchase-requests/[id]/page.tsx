import { ExecutionType, Role } from "@/lib/prisma-enums";
import { notFound } from "next/navigation";

import {
  PRDetailInternalPrintBody,
  PRDetailInternalPrintSide,
  PRDetailProgress,
  PRDetailVersionHistory,
} from "@/components/purchase-requests/PRDetailSections";
import { PRDetailPageShell } from "@/components/purchase-requests/PRDetailPageShell";
import {
  EMPTY_PR_FILTER_OPTIONS,
  getFilterOptions,
  getPRById,
  prDetailNeedsFilterOptions,
} from "@/lib/queries/purchase-requests";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";

type Params = Promise<{ id: string }>;

export default async function PurchaseRequestDetailPage({ params }: { params: Params }) {
  const user = assertRole(await getRequestSession(), [...ACCESS.purchaseRequests]);
  const { id } = await params;

  const pr = await getPRById(user, id);
  if (!pr) {
    notFound();
  }

  const filterOptions = prDetailNeedsFilterOptions(user.role, pr.status)
    ? await getFilterOptions()
    : EMPTY_PR_FILTER_OPTIONS;

  const isInternalPrint = pr.executionType === ExecutionType.INTERNAL_PRINT;

  return (
    <PRDetailPageShell
      pr={pr}
      role={user.role}
      categories={filterOptions.categories}
      subcategories={filterOptions.subcategories}
      catalogItems={filterOptions.catalogItems}
      sidePanel={
        isInternalPrint ? (
          <PRDetailInternalPrintSide pr={pr} role={user.role} />
        ) : (
          <PRDetailProgress pr={pr} />
        )
      }
      printSlot={isInternalPrint ? <PRDetailInternalPrintBody pr={pr} /> : null}
      versionHistorySlot={<PRDetailVersionHistory pr={pr} />}
    />
  );
}

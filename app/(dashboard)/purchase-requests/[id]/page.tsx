import { ExecutionType } from "@/lib/prisma-enums";
import { notFound } from "next/navigation";

import {
  PRDetailInternalPrintBody,
  PRDetailInternalPrintSide,
  PRDetailLockTagsSerialPreview,
  PRDetailProgress,
  PRDetailVersionHistory,
} from "@/components/purchase-requests/PRDetailSections";
import { PRDetailPageShell } from "@/components/purchase-requests/PRDetailPageShell";
import { getLockTagsSerialPreviewForPRQuery } from "@/lib/serial-preview";
import {
  EMPTY_PR_FILTER_OPTIONS,
  getFilterOptions,
  getPRById,
  prDetailNeedsFilterOptions,
} from "@/lib/queries/purchase-requests";
import {
  canEditDraftPurchaseRequestAsOps,
  canEditOwnDraftPurchaseRequest,
  canRevisePurchaseRequest,
} from "@/lib/pr-access";
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

  const isInternalPrint = pr.executionType === ExecutionType.INTERNAL_PRINT;

  // `getFilterOptions` and serial preview both depend only on `pr` (already loaded).
  const [filterOptions, lockTagsPreview] = await Promise.all([
    prDetailNeedsFilterOptions(user.role, pr.status)
      ? getFilterOptions()
      : Promise.resolve(EMPTY_PR_FILTER_OPTIONS),
    !isInternalPrint ? getLockTagsSerialPreviewForPRQuery(user, id) : Promise.resolve(null),
  ]);

  const prAccess = {
    status: pr.status,
    warehouseId: pr.warehouseId,
    createdById: pr.createdById,
  };
  const canRevise = canRevisePurchaseRequest(user, prAccess);
  const canEditDraft =
    canEditOwnDraftPurchaseRequest(user, prAccess) ||
    canEditDraftPurchaseRequestAsOps(user, prAccess);

  return (
    <PRDetailPageShell
      pr={pr}
      role={user.role}
      canRevise={canRevise}
      canEditDraft={canEditDraft}
      categories={filterOptions.categories}
      subcategories={filterOptions.subcategories}
      catalogItems={filterOptions.catalogItems}
      sidePanel={
        isInternalPrint ? (
          <PRDetailInternalPrintSide pr={pr} role={user.role} />
        ) : (
          <div className="space-y-4">
            {lockTagsPreview ? (
              <PRDetailLockTagsSerialPreview preview={lockTagsPreview} status={pr.status} />
            ) : null}
            <PRDetailProgress pr={pr} />
          </div>
        )
      }
      printSlot={isInternalPrint ? <PRDetailInternalPrintBody pr={pr} /> : null}
      versionHistorySlot={<PRDetailVersionHistory pr={pr} />}
    />
  );
}

"use client";

import { ExecutionType, PRStatus, Role } from "@/lib/prisma-enums";
import Link from "next/link";

import type {
  CatalogItemOption,
  PRDetail,
  CategoryOption,
  SubcategoryOption,
} from "@/lib/queries/purchase-requests";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { DetailPageShell } from "@/components/shared/DetailPageShell";
import { ProgressTracker } from "@/components/shared/ProgressTracker";
import { PRDetailView } from "@/components/purchase-requests/PRDetailView";
import type { PRLifecycleStepperProps } from "@/components/purchase-requests/PRLifecycleStepper";
import { Button } from "@/components/ui/button";
import {
  formatPrPageTitle,
  formatProcurementRef,
} from "@/lib/display-ref";
import { formatDateTimeMedium } from "@/lib/format-datetime";
import { prDetailBreadcrumbs } from "@/lib/lineage";

export function PRDetailPageShell({
  pr,
  role,
  canRevise = false,
  canEditDraft = false,
  categories,
  subcategories,
  catalogItems = [],
  progressSlot,
  sidePanel,
  printSlot,
  versionHistorySlot,
}: {
  pr: PRDetail;
  role: Role;
  canRevise?: boolean;
  canEditDraft?: boolean;
  categories: CategoryOption[];
  subcategories: SubcategoryOption[];
  catalogItems?: CatalogItemOption[];
  progressSlot?: React.ReactNode;
  sidePanel?: React.ReactNode;
  printSlot?: React.ReactNode;
  versionHistorySlot?: React.ReactNode;
}) {
  const breadcrumbs = prDetailBreadcrumbs(pr.id);

  return (
    <DetailPageShell
      hero={
        <div className="space-y-4">
          <Breadcrumbs items={breadcrumbs} />
          <ProgressTracker
            variant="stepper"
            {...(pr.executionType === ExecutionType.INTERNAL_PRINT
              ? ({
                  executionType: ExecutionType.INTERNAL_PRINT,
                  status: pr.status,
                  hasSerialReservation: Boolean(pr.serialReservation),
                  cancelled:
                    pr.status === PRStatus.CANCELLED || pr.status === PRStatus.FORCE_CANCELLED,
                } satisfies Extract<
                  PRLifecycleStepperProps,
                  { executionType: typeof ExecutionType.INTERNAL_PRINT }
                >)
              : ({
                  executionType: ExecutionType.VENDOR_PURCHASE,
                  status: pr.status,
                  hasPO: pr.purchaseOrders.length > 0,
                  hasGRN: pr.progress.grnRecorded,
                  hasInvoice: pr.progress.invoiceUploaded,
                  isPaid: pr.progress.paymentReceived,
                  cancelled:
                    pr.status === PRStatus.CANCELLED || pr.status === PRStatus.FORCE_CANCELLED,
                } satisfies Extract<
                  PRLifecycleStepperProps,
                  { executionType: typeof ExecutionType.VENDOR_PURCHASE }
                >))}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-ds-lg font-semibold tracking-tight text-foreground">
                {formatPrPageTitle({
                  id: pr.id,
                  categoryName: pr.categoryName,
                  subcategoryName: pr.subcategoryName,
                })}
              </h1>
              <p className="text-ds-sm text-muted-foreground">
                {formatProcurementRef(pr.id)} · Created by {pr.createdByName} on{" "}
                {formatDateTimeMedium(pr.createdAt)}
              </p>
            </div>
            <Button variant="outline" size="sm" render={<Link href="/purchase-requests" />}>
              Back to list
            </Button>
          </div>
        </div>
      }
      side={sidePanel ?? progressSlot}
      body={
        <PRDetailView
          pr={pr}
          role={role}
          canRevise={canRevise}
          canEditDraft={canEditDraft}
          categories={categories}
          subcategories={subcategories}
          catalogItems={catalogItems}
          embeddedInShell
          printSlot={printSlot}
          versionHistorySlot={versionHistorySlot}
        />
      }
    />
  );
}

"use client";

import { PRStatus, Role } from "@prisma/client";
import Link from "next/link";

import type { PRDetail, CategoryOption, SubcategoryOption } from "@/app/actions/purchase-requests";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { DetailPageShell } from "@/components/shared/DetailPageShell";
import { ProgressTracker } from "@/components/shared/ProgressTracker";
import { PRDetailView } from "@/components/purchase-requests/PRDetailView";
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
  categories,
  subcategories,
  progressSlot,
  printSlot,
  versionHistorySlot,
}: {
  pr: PRDetail;
  role: Role;
  categories: CategoryOption[];
  subcategories: SubcategoryOption[];
  progressSlot?: React.ReactNode;
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
            status={pr.status}
            hasPO={!!pr.purchaseOrder}
            hasGRN={pr.progress.grnRecorded}
            hasInvoice={pr.progress.invoiceUploaded}
            isPaid={pr.progress.paymentReceived}
            cancelled={
              pr.status === PRStatus.CANCELLED || pr.status === PRStatus.FORCE_CANCELLED
            }
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
      side={progressSlot}
      body={
        <PRDetailView
          pr={pr}
          role={role}
          categories={categories}
          subcategories={subcategories}
          embeddedInShell
          printSlot={printSlot}
          versionHistorySlot={versionHistorySlot}
        />
      }
    />
  );
}

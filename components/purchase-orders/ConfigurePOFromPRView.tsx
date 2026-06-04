"use client";

import Link from "next/link";

import { CreatePOFromPRForm } from "@/components/purchase-orders/CreatePOFromPRForm";
import { PageHeader } from "@/components/shared/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { configurePOBreadcrumbs } from "@/lib/lineage";
import type { ApprovedPRAwaitingPO } from "@/lib/queries/purchase-orders";
import { cn } from "@/lib/utils";

type ActiveVendor = { id: string; businessName: string; gst: string | null };

export function ConfigurePOFromPRView({
  pr,
  activeVendors,
}: {
  pr: ApprovedPRAwaitingPO;
  activeVendors: ActiveVendor[];
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={configurePOBreadcrumbs(pr.id)}
        title="Configure purchase order"
        subtitle="Select vendor, unit price, and expected delivery before issuing a PO."
        action={
          <Link
            href="/purchase-orders/configure"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Back to queue
          </Link>
        }
      />

      <CreatePOFromPRForm pr={pr} activeVendors={activeVendors} />
    </div>
  );
}

export function ConfigurePONotAvailable() {
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={configurePOBreadcrumbs()}
        title="Purchase request not available"
      />
      <p className="text-ds-sm text-muted-foreground">
        This request is not approved, already has a purchase order, or is outside your scope.
      </p>
      <Link href="/purchase-orders/configure" className={cn(buttonVariants({ variant: "outline" }))}>
        Back to queue
      </Link>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { getInvoicePaymentDetail } from "@/app/actions/payments";
import {
  InvoiceSettlementPanel,
  type InvoiceSettlementPanelHandle,
} from "@/components/payments/InvoiceSettlementPanel";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  SurfaceCard,
  SurfaceCardDescription,
  SurfaceCardTitle,
} from "@/components/shared/SurfaceCard";
import { Button, buttonVariants } from "@/components/ui/button";
import { FINANCE_ROUTES } from "@/lib/finance-routes";
import { financeInvoiceSettlementDetailBreadcrumbs } from "@/lib/lineage";
import type { InvoicePaymentDetail } from "@/lib/queries/payments";
import { cn } from "@/lib/utils";

export function InvoiceSettlementPageView({
  initialDetail,
}: {
  initialDetail: InvoicePaymentDetail;
}) {
  const router = useRouter();
  const panelRef = React.useRef<InvoiceSettlementPanelHandle>(null);
  const [detail, setDetail] = React.useState(initialDetail);
  const [actionState, setActionState] = React.useState({
    submitting: false,
    confirmLabel: "Confirm settlement",
    canSubmit: false,
  });

  React.useEffect(() => {
    setDetail(initialDetail);
  }, [initialDetail]);

  const remaining = Number(detail.remaining);

  async function reload(invoiceId: string) {
    const updated = await getInvoicePaymentDetail(invoiceId);
    if (updated) {
      setDetail(updated);
    }
    return updated;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={financeInvoiceSettlementDetailBreadcrumbs(detail.invoiceNumber)}
        title={`Invoice ${detail.invoiceNumber}`}
        subtitle={detail.vendorName}
        action={
          <Link
            href={FINANCE_ROUTES.invoiceSettlement}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Back to list
          </Link>
        }
      />

      <SurfaceCard
        header={
          <>
            <SurfaceCardTitle>Settle invoice</SurfaceCardTitle>
            <SurfaceCardDescription>
              Apply PO advance credit and record bank transfers against this invoice.
            </SurfaceCardDescription>
          </>
        }
        footer={
          remaining > 0 ? (
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                disabled={!actionState.canSubmit}
                onClick={() => panelRef.current?.requestSubmit()}
              >
                {actionState.submitting ? "Saving…" : actionState.confirmLabel}
              </Button>
            </div>
          ) : undefined
        }
      >
        <InvoiceSettlementPanel
          ref={panelRef}
          detail={detail}
          onDetailReload={reload}
          onSuccess={() => router.refresh()}
          resetKey={detail.invoiceId}
          onActionStateChange={setActionState}
        />
      </SurfaceCard>
    </div>
  );
}

"use client";

import * as React from "react";

import {
  InvoiceSettlementPanel,
  type InvoiceSettlementPanelHandle,
} from "@/components/payments/InvoiceSettlementPanel";
import { FormDrawer } from "@/components/shared/Drawer";
import { Button } from "@/components/ui/button";
import type { InvoicePaymentDetail } from "@/lib/queries/payments";

export function InvoiceSettlementDrawer({
  open,
  onOpenChange,
  detail,
  loading,
  onDetailReload,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: InvoicePaymentDetail | null;
  loading: boolean;
  onDetailReload: (invoiceId: string) => Promise<InvoicePaymentDetail | null>;
  onSuccess: () => void;
}) {
  const panelRef = React.useRef<InvoiceSettlementPanelHandle>(null);
  const [actionState, setActionState] = React.useState({
    submitting: false,
    confirmLabel: "Confirm settlement",
    canSubmit: false,
  });

  const remaining = Number(detail?.remaining ?? 0);

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={detail ? `Invoice ${detail.invoiceNumber}` : "Invoice details"}
      description={detail?.vendorName}
      footer={
        detail && remaining > 0 ? (
          <>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              type="button"
              disabled={!actionState.canSubmit}
              onClick={() => panelRef.current?.requestSubmit()}
            >
              {actionState.submitting ? "Saving…" : actionState.confirmLabel}
            </Button>
          </>
        ) : detail ? (
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        ) : null
      }
    >
      <InvoiceSettlementPanel
        ref={panelRef}
        detail={detail}
        loading={loading}
        onDetailReload={onDetailReload}
        onSuccess={onSuccess}
        onSettled={() => onOpenChange(false)}
        resetKey={open ? detail?.invoiceId : undefined}
        onActionStateChange={setActionState}
      />
    </FormDrawer>
  );
}

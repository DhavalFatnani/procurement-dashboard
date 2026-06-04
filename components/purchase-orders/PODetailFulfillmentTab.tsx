"use client";

import { POStatus, Role } from "@/lib/prisma-enums";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { generateVendorLockTagSerialCSV } from "@/app/actions/serial";

import { PODetailDisputeWorkbench } from "@/components/purchase-orders/PODetailDisputeWorkbench";
import { PODetailGrnHistoryTable } from "@/components/purchase-orders/PODetailGrnHistoryTable";
import { PODetailReceivingContext } from "@/components/purchase-orders/PODetailReceivingContext";
import { PODetailReceivingFollowups } from "@/components/purchase-orders/PODetailReceivingFollowups";
import { PODetailReplacementBanner } from "@/components/purchase-orders/PODetailReplacementBanner";
import {
  SurfaceCard,
  SurfaceCardDescription,
  SurfaceCardTitle,
} from "@/components/shared/SurfaceCard";
import { Button } from "@/components/ui/button";
import { downloadCsvFile } from "@/lib/download-csv";
import type { PODetail } from "@/lib/queries/purchase-orders";

const RECEIVING_STATUSES: POStatus[] = [
  POStatus.OPEN,
  POStatus.PARTIALLY_RECEIVED,
];

export function PODetailFulfillmentTab({
  po,
  role,
}: {
  po: PODetail;
  role: Role;
}) {
  const searchParams = useSearchParams();
  const isOps = role === Role.OPS_HEAD;
  const canRecordGrn =
    (role === Role.SM || role === Role.OPS_HEAD) &&
    RECEIVING_STATUSES.includes(po.status);

  const [expandedGrnId, setExpandedGrnId] = React.useState<string | null>(null);
  const [expandedExceptionId, setExpandedExceptionId] = React.useState<string | null>(
    null,
  );

  const deepLinkExceptionId = searchParams.get("resolveExceptionId");

  const handleViewReceipt = React.useCallback((grnId: string) => {
    setExpandedGrnId(grnId);
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-grn-id="${grnId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  React.useEffect(() => {
    if (!deepLinkExceptionId) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") !== "fulfillment") {
      params.set("tab", "fulfillment");
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}?${params.toString()}`,
      );
    }
  }, [deepLinkExceptionId]);

  return (
    <div className="section-stack">
      <PODetailReceivingContext po={po} />

      <PODetailDisputeWorkbench
        po={po}
        isOps={isOps}
        expandedExceptionId={expandedExceptionId}
        onExpandedExceptionChange={setExpandedExceptionId}
        onViewReceipt={handleViewReceipt}
        deepLinkExceptionId={deepLinkExceptionId}
      />

      <PODetailReplacementBanner po={po} />

      <PODetailReceivingFollowups po={po} onViewReceipt={handleViewReceipt} />

      <PODetailGrnHistoryTable
        po={po}
        canRecordGrn={canRecordGrn}
        expandedGrnId={expandedGrnId}
        onExpandedGrnChange={setExpandedGrnId}
        highlightGrnId={expandedGrnId}
      />

      {po.isLockTags && po.serialReservation ? (
        <SurfaceCard
          header={
            <>
              <SurfaceCardTitle>Serial fulfillment</SurfaceCardTitle>
              <SurfaceCardDescription>
                Cross-check physical tags received against the reserved range. Share the CSV
                with the vendor for printing.
              </SurfaceCardDescription>
            </>
          }
        >
          <div className="grid gap-3 text-ds-sm sm:grid-cols-3">
            <SerialMeta label="Series" value={po.serialReservation.series} />
            <SerialMeta
              label="Range"
              value={`${po.serialReservation.rangeStart} → ${po.serialReservation.rangeEnd}`}
            />
            <SerialMeta
              label="Status"
              value={po.serialReservation.status.replaceAll("_", " ")}
            />
          </div>
          {isOps ? (
            <VendorLockTagSerialExport poId={po.id} />
          ) : null}
        </SurfaceCard>
      ) : null}
    </div>
  );
}

function SerialMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-ds-2xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 font-tabular text-foreground">{value}</p>
    </div>
  );
}

function VendorLockTagSerialExport({ poId }: { poId: string }) {
  const [pending, setPending] = React.useState(false);

  async function handleDownload() {
    setPending(true);
    try {
      const csv = await generateVendorLockTagSerialCSV(poId);
      if (!csv) {
        toast.error("Serial range not found for this purchase order.");
        return;
      }
      downloadCsvFile(csv, `${poId}-lock-tag-serials.csv`);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 border-t border-border-subtle pt-4">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        loading={pending}
        onClick={() => void handleDownload()}
      >
        Download serial CSV for vendor
      </Button>
    </div>
  );
}

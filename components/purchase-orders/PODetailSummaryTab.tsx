"use client";

import { POStatus, Role } from "@/lib/prisma-enums";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { updatePOExpectedDelivery } from "@/app/actions/purchase-orders";
import { ProcurementRefLink } from "@/components/shared/ProcurementRef";
import {
  SurfaceCard,
  SurfaceCardDescription,
  SurfaceCardTitle,
} from "@/components/shared/SurfaceCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateMedium, formatInr } from "@/lib/format-datetime";
import type { PODetail } from "@/lib/queries/purchase-orders";
import { cn } from "@/lib/utils";

const NON_EDITABLE: POStatus[] = [
  POStatus.CLOSED,
  POStatus.PARTIALLY_CLOSED,
  POStatus.FORCE_CLOSED,
];

export function PODetailSummaryTab({
  po,
  role,
}: {
  po: PODetail;
  role: Role;
}) {
  const billingLines =
    po.lineItems.length > 0 ? po.lineItems : po.lines;
  const totalValue = billingLines.reduce(
    (sum, line) => sum + line.orderedQty * Number(line.unitPrice),
    0,
  );
  const canEditDelivery =
    role === Role.OPS_HEAD && !NON_EDITABLE.includes(po.status);

  return (
    <div className="section-stack">
      <SurfaceCard>
        <div className="grid gap-x-6 gap-y-4 text-ds-sm sm:grid-cols-2 lg:grid-cols-3">
          <MetaCell label="PR">
            <ProcurementRefLink id={po.prId} className="text-primary" />
          </MetaCell>
          <MetaCell label="Items">{po.lineSummary}</MetaCell>
          <MetaCell label="Ordered qty">
            <span className="font-tabular">{po.orderedQty}</span>
          </MetaCell>
          <MetaCell label="Order value">
            <span className="font-tabular">{formatInr(String(totalValue))}</span>
          </MetaCell>
          <MetaCell label="Delivery state">
            {po.deliveryComplete ? "Delivery complete" : "In progress"}
          </MetaCell>
          <ExpectedDeliveryCell
            po={po}
            canEdit={canEditDelivery}
          />
        </div>
      </SurfaceCard>

      {billingLines.length > 0 ? (
        <SurfaceCard
          header={
            <>
              <SurfaceCardTitle>Line items</SurfaceCardTitle>
              <SurfaceCardDescription>
                {billingLines.length}{" "}
                {billingLines.length === 1 ? "item" : "items"}
              </SurfaceCardDescription>
            </>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-ds-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-ds-xs text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">#</th>
                  <th className="pb-2 pr-3 font-medium">Item</th>
                  <th className="pb-2 pr-3 font-medium text-right">Ordered</th>
                  <th className="pb-2 pr-3 font-medium text-right">Received</th>
                  <th className="pb-2 pr-3 font-medium text-right">
                    Unit price
                  </th>
                  <th className="pb-2 font-medium text-right">Line value</th>
                </tr>
              </thead>
              <tbody>
                {po.lineItems.length > 0
                  ? po.lineItems.map((line) => {
                      const lineValue =
                        line.orderedQty * Number(line.unitPrice);
                      const ratio =
                        line.orderedQty > 0
                          ? line.receivedQty / line.orderedQty
                          : 0;
                      return (
                        <tr
                          key={line.id}
                          className="border-b border-border-subtle last:border-0"
                        >
                          <td className="py-2 pr-3 tabular-nums">
                            {line.lineNumber}.{line.lineItemNumber}
                          </td>
                          <td className="py-2 pr-3">
                            <span className="font-medium">{line.itemName}</span>
                            <span className="block text-ds-xs text-muted-foreground">
                              {line.categoryName} / {line.subcategoryName}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {line.orderedQty}
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <span className="inline-flex items-baseline gap-1.5">
                              <span className="font-tabular">
                                {line.receivedQty}
                              </span>
                              <span
                                className={cn(
                                  "text-ds-2xs",
                                  ratio >= 1
                                    ? "text-status-success"
                                    : ratio > 0
                                      ? "text-status-warning"
                                      : "text-muted-foreground",
                                )}
                              >
                                {Math.round(ratio * 100)}%
                              </span>
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {formatInr(line.unitPrice)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {formatInr(String(lineValue))}
                          </td>
                        </tr>
                      );
                    })
                  : po.lines.map((line) => {
                  const lineValue =
                    line.orderedQty * Number(line.unitPrice);
                  const ratio =
                    line.orderedQty > 0
                      ? line.receivedQty / line.orderedQty
                      : 0;
                  return (
                    <tr
                      key={line.id}
                      className="border-b border-border-subtle last:border-0"
                    >
                      <td className="py-2 pr-3">{line.lineNumber}</td>
                      <td className="py-2 pr-3">
                        {line.categoryName} / {line.subcategoryName}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {line.orderedQty}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <span className="inline-flex items-baseline gap-1.5">
                          <span className="font-tabular">
                            {line.receivedQty}
                          </span>
                          <span
                            className={cn(
                              "text-ds-2xs",
                              ratio >= 1
                                ? "text-status-success"
                                : ratio > 0
                                  ? "text-status-warning"
                                  : "text-muted-foreground",
                            )}
                          >
                            {Math.round(ratio * 100)}%
                          </span>
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatInr(line.unitPrice)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatInr(String(lineValue))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      ) : null}

      {po.isLockTags && po.serialReservation ? (
        <SurfaceCard
          header={
            <>
              <SurfaceCardTitle>Serial range reference</SurfaceCardTitle>
              <SurfaceCardDescription>
                Lock-tags fulfillment range reserved for this PO.
              </SurfaceCardDescription>
            </>
          }
        >
          <div className="grid gap-3 text-ds-sm sm:grid-cols-3">
            <MetaCell label="Series">
              <span className="font-tabular">
                {po.serialReservation.series}
              </span>
            </MetaCell>
            <MetaCell label="Range">
              <span className="font-tabular">
                {po.serialReservation.rangeStart} →{" "}
                {po.serialReservation.rangeEnd}
              </span>
            </MetaCell>
            <MetaCell label="Status">
              {po.serialReservation.status.replaceAll("_", " ")}
            </MetaCell>
          </div>
        </SurfaceCard>
      ) : null}

      {po.forceCloseReason ? (
        <SurfaceCard
          className="border-l-[3px] border-l-status-warning bg-[var(--status-warning-bg)]"
          header={
            <SurfaceCardTitle className="text-status-warning">
              Force close reason
            </SurfaceCardTitle>
          }
        >
          <p className="text-ds-sm text-foreground">{po.forceCloseReason}</p>
        </SurfaceCard>
      ) : null}
    </div>
  );
}

function MetaCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-ds-2xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-0.5 text-foreground">{children}</div>
    </div>
  );
}

function ExpectedDeliveryCell({
  po,
  canEdit,
}: {
  po: PODetail;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(
    po.expectedDelivery ? po.expectedDelivery.slice(0, 10) : "",
  );
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setValue(po.expectedDelivery ? po.expectedDelivery.slice(0, 10) : "");
  }, [po.expectedDelivery]);

  async function save() {
    if (!value) return;
    setSaving(true);
    const res = await updatePOExpectedDelivery(po.id, value);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.message ?? "Failed to update date.");
      return;
    }
    toast.success("Expected delivery updated.");
    setEditing(false);
    router.refresh();
  }

  return (
    <div>
      <p className="text-ds-2xs font-semibold uppercase tracking-wide text-muted-foreground">
        Expected delivery
      </p>
      {!editing ? (
        <div className="mt-0.5 flex items-center gap-2 text-foreground">
          <span>{formatDateMedium(po.expectedDelivery)}</span>
          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-ds-xs"
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-8 max-w-[180px]"
          />
          <Button
            type="button"
            size="sm"
            className="h-8"
            disabled={saving || !value}
            onClick={() => void save()}
          >
            Save
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => {
              setEditing(false);
              setValue(
                po.expectedDelivery ? po.expectedDelivery.slice(0, 10) : "",
              );
            }}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

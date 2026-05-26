"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { createPOFromPR } from "@/app/actions/purchase-requests";
import { formatPrPageTitle, formatProcurementRef } from "@/lib/display-ref";
import type { ApprovedPRAwaitingPO } from "@/lib/queries/purchase-orders";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { formatDateMedium } from "@/lib/format-datetime";

type ActiveVendor = { id: string; businessName: string };

export function CreatePOFromPRPanel({
  pr,
  activeVendors,
  defaultOpen,
  onSuccess,
}: {
  pr: ApprovedPRAwaitingPO;
  activeVendors: ActiveVendor[];
  defaultOpen?: boolean;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(defaultOpen ?? false);
  const [vendorId, setVendorId] = React.useState("");
  const [linePrices, setLinePrices] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(pr.lines.map((line) => [line.id, ""])),
  );
  const [expectedDelivery, setExpectedDelivery] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function submit() {
    startTransition(async () => {
      const result = await createPOFromPR(pr.id, {
        vendorId,
        expectedDelivery,
        linePrices: pr.lines.map((line) => ({
          prLineId: line.id,
          unitPrice: Number(linePrices[line.id] ?? 0),
        })),
      });
      if (!result.ok || !result.poId) {
        toast.error(result.message ?? "Could not create purchase order.");
        return;
      }
      toast.success(`Purchase order ${formatProcurementRef(result.poId)} created.`);
      setOpen(false);
      onSuccess?.();
      router.push(`/purchase-orders/${result.poId}`);
      router.refresh();
    });
  }

  const allPricesFilled = pr.lines.every((line) => {
    const price = Number(linePrices[line.id]);
    return Number.isFinite(price) && price > 0;
  });

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Configure PO
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border-subtle bg-muted/20 p-4">
      <p className="text-ds-sm font-medium">
        Fulfillment for{" "}
        {formatPrPageTitle({
          id: pr.id,
          categoryName: pr.categoryName,
          subcategoryName: pr.subcategoryName,
        })}
      </p>
      <p className="text-ds-xs text-muted-foreground">
        {pr.lineSummary} · {pr.quantity} total qty · {pr.warehouseName}
      </p>
      {pr.vendorRequestLabel ? (
        <p className="text-ds-xs text-status-warning">
          Linked vendor request: {pr.vendorRequestLabel}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-md border border-border-subtle">
        <table className="w-full text-ds-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-muted/30 text-left text-ds-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Line</th>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium text-right">Qty</th>
              <th className="px-3 py-2 font-medium text-right">Unit price (INR)</th>
            </tr>
          </thead>
          <tbody>
            {pr.lines.map((line) => (
              <tr key={line.id} className="border-b border-border-subtle last:border-0">
                <td className="px-3 py-2">{line.lineNumber}</td>
                <td className="px-3 py-2">
                  {line.categoryName} / {line.subcategoryName}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{line.quantity}</td>
                <td className="px-3 py-2">
                  <Input
                    id={`fulfill-price-${line.id}`}
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={linePrices[line.id] ?? ""}
                    onChange={(e) =>
                      setLinePrices((prev) => ({ ...prev, [line.id]: e.target.value }))
                    }
                    className="ml-auto h-8 max-w-[140px] text-right"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor={`fulfill-vendor-${pr.id}`} className="text-ds-sm font-medium">
            Vendor
          </label>
          <Combobox
            value={vendorId}
            onChange={setVendorId}
            options={activeVendors.map((v) => ({
              value: v.id,
              label: v.businessName,
            }))}
            placeholder="Select vendor"
            searchPlaceholder="Search vendors…"
            emptyText="No vendors match"
            ariaLabel="Vendor"
            size="sm"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor={`fulfill-date-${pr.id}`} className="text-ds-sm font-medium">
            Expected delivery
          </label>
          <Input
            id={`fulfill-date-${pr.id}`}
            type="date"
            required
            value={expectedDelivery}
            onChange={(e) => setExpectedDelivery(e.target.value)}
            className="h-8"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={pending || !vendorId || !expectedDelivery || !allPricesFilled}
          onClick={() => submit()}
        >
          Create purchase order
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <p className="text-ds-xs text-muted-foreground">
        Submitted {formatDateMedium(pr.createdAt)} by {pr.createdByName}
      </p>
    </div>
  );
}

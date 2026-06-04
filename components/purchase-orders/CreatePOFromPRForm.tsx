"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import {
  createPOFromPR,
  exportPORateCsvForPR,
  validatePORateCsvForPR,
} from "@/app/actions/purchase-requests";
import { Button, buttonVariants } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { formatPrPageTitle, formatProcurementRef } from "@/lib/display-ref";
import { formatDateMedium, formatInr } from "@/lib/format-datetime";
import type { ApprovedPRAwaitingPO } from "@/lib/queries/purchase-orders";
import { useServerMutation } from "@/lib/use-server-mutation";
import { cn } from "@/lib/utils";

type ActiveVendor = { id: string; businessName: string };

export function CreatePOFromPRForm({
  pr,
  activeVendors,
}: {
  pr: ApprovedPRAwaitingPO;
  activeVendors: ActiveVendor[];
}) {
  const router = useRouter();
  const { isPending, run } = useServerMutation();
  const [vendorId, setVendorId] = React.useState("");
  const lineItems = pr.lineItems;
  const [itemPrices, setItemPrices] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(lineItems.map((item) => [item.prLineItemId, ""])),
  );
  const [expectedDelivery, setExpectedDelivery] = React.useState("");
  const [csvErrors, setCsvErrors] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function submit() {
    void run(
      () =>
        createPOFromPR(pr.id, {
          vendorId,
          expectedDelivery,
          itemPrices: lineItems.map((item) => ({
            prLineItemId: item.prLineItemId,
            unitPrice: Number(itemPrices[item.prLineItemId] ?? 0),
          })),
        }),
      {
        refresh: false,
        onSuccess: (result) => {
          const poId =
            result && typeof result === "object" && "poId" in result
              ? (result as { poId?: string }).poId
              : undefined;
          if (!poId) {
            toast.error("Could not create purchase order.");
            return;
          }
          toast.success(`Purchase order ${formatProcurementRef(poId)} created.`);
          router.push(`/purchase-orders/${poId}`);
        },
        onError: (m) => toast.error(m),
      },
    );
  }

  const allPricesFilled = lineItems.every((item) => {
    const price = Number(itemPrices[item.prLineItemId]);
    return Number.isFinite(price) && price > 0;
  });

  async function downloadRateCsv() {
    const result = await exportPORateCsvForPR(pr.id);
    if (!result.ok) {
      toast.error(result.message ?? "Could not export CSV.");
      return;
    }
    const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleCsvUpload(file: File) {
    const text = await file.text();
    const result = await validatePORateCsvForPR(pr.id, text);
    if (!result.ok) {
      setCsvErrors(result.message ?? "CSV validation failed.");
      return;
    }
    setCsvErrors(null);
    setItemPrices((prev) => {
      const next = { ...prev };
      for (const row of result.itemPrices) {
        next[row.prLineItemId] = String(row.unitPrice);
      }
      return next;
    });
    toast.success("Rates applied from CSV.");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-ds surface-glow">
        <p className="text-ds-sm font-medium">
          Fulfillment for{" "}
          {formatPrPageTitle({
            id: pr.id,
            categoryName: pr.categoryName,
            subcategoryName: pr.subcategoryName,
          })}
        </p>
        <p className="mt-1 text-ds-xs text-muted-foreground">
          {pr.lineSummary} · {pr.quantity} total qty · {pr.warehouseName}
        </p>
        {pr.vendorRequestLabel ? (
          <p className="mt-1 text-ds-xs text-status-warning">
            Linked vendor request: {pr.vendorRequestLabel}
          </p>
        ) : null}
        <p className="mt-2 text-ds-xs text-muted-foreground">
          Submitted {formatDateMedium(pr.createdAt)} by {pr.createdByName}
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-border-subtle bg-card p-4 shadow-ds surface-glow">
        <div>
          <h2 className="text-ds-sm font-semibold">Line item rates</h2>
          <p className="text-ds-xs text-muted-foreground">
            Enter unit prices manually or import from CSV.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => void downloadRateCsv()}
          >
            Download rate CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload rate CSV
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) {
                void handleCsvUpload(file);
              }
            }}
          />
        </div>
        {csvErrors ? (
          <p className="text-ds-xs text-[var(--status-error)]">{csvErrors}</p>
        ) : null}

        <div className="overflow-x-auto rounded-md border border-border-subtle">
          <table className="w-full text-ds-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-muted/30 text-left text-ds-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Line</th>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium text-right">Qty</th>
                <th className="px-3 py-2 font-medium text-right">Previous rate (INR)</th>
                <th className="px-3 py-2 font-medium text-right">Unit price (INR)</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item) => (
                <tr key={item.prLineItemId} className="border-b border-border-subtle last:border-0">
                  <td className="px-3 py-2 tabular-nums">
                    {item.lineNumber}.{item.lineItemNumber}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{item.itemName}</span>
                    <span className="block text-ds-xs text-muted-foreground">
                      {item.categoryName} / {item.subcategoryName}
                      {item.sku ? ` · ${item.sku}` : ""} · {item.unit}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {formatInr(item.previousUnitPrice)}
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      id={`fulfill-price-${item.prLineItemId}`}
                      type="number"
                      min={0}
                      step="0.01"
                      required
                      value={itemPrices[item.prLineItemId] ?? ""}
                      onChange={(e) =>
                        setItemPrices((prev) => ({
                          ...prev,
                          [item.prLineItemId]: e.target.value,
                        }))
                      }
                      className="ml-auto h-8 max-w-[140px] text-right"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-border-subtle bg-card p-4 shadow-ds surface-glow">
        <div>
          <h2 className="text-ds-sm font-semibold">Vendor and delivery</h2>
          <p className="text-ds-xs text-muted-foreground">
            Select the supplier and expected delivery date before issuing the PO.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
              className="h-8 max-w-xs"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={isPending || !vendorId || !expectedDelivery || !allPricesFilled}
          onClick={() => submit()}
        >
          Create purchase order
        </Button>
        <Link href="/purchase-orders/configure" className={cn(buttonVariants({ variant: "outline" }))}>
          Cancel
        </Link>
      </div>
    </div>
  );
}

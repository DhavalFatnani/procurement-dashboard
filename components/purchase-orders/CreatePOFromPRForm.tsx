"use client";

import Link from "next/link";
import { GitCompare } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import {
  createPOFromPRGroup,
  exportPORateCsvForPR,
  linkCatalogItemVendor,
  validatePORateCsvForPR,
} from "@/app/actions/purchase-requests";
import {
  getLockTagsSerialPreviewForPRItems,
} from "@/app/actions/serial";
import type { LockTagsSerialPreview } from "@/lib/serial-governance-types";
import { VendorItemComparisonDrawer } from "@/components/purchase-orders/VendorItemComparisonDrawer";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ProcurementRefLink } from "@/components/shared/ProcurementRef";
import { Switch } from "@/components/shared/Switch";
import { Button, buttonVariants } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { resolveAdvanceRequestAmount } from "@/lib/po-advance";
import { lockTagsQtyFromLineItems } from "@/lib/purchase-lines";
import {
  computePoOrderBilling,
  defaultGstApplicableForVendor,
  defaultGstRatePercentForVendor,
  STANDARD_GST_RATES,
  validatePoGstInput,
} from "@/lib/po-gst";
import { formatPrPageTitle, formatProcurementRef } from "@/lib/display-ref";
import { formatDateMedium, formatInr } from "@/lib/format-datetime";
import { formatOrderTotalsInline, formatUnitCount } from "@/lib/order-totals-display";
import type {
  ApprovedPRAwaitingPO,
  ApprovedPRLineItemRow,
} from "@/lib/queries/purchase-orders";
import { useServerMutation } from "@/lib/use-server-mutation";
import { cn } from "@/lib/utils";

type ActiveVendor = { id: string; businessName: string; gst: string | null };

type GroupGstDraft = {
  gstApplicable: boolean;
  gstRatePercent: string;
};

type GroupAdvanceDraft = {
  enabled: boolean;
  mode: "amount" | "percent";
  amount: string;
  percent: string;
  reason: string;
};

type ItemDraft = {
  vendorId: string;
  unitPrice: string;
};

function unassignedItems(items: ApprovedPRLineItemRow[]) {
  return items.filter((item) => !item.alreadyOnPo);
}

function assignedItems(items: ApprovedPRLineItemRow[]) {
  return items.filter((item) => item.alreadyOnPo);
}

type RateCompareTone = "lower" | "higher" | "same" | "unknown";

function compareUnitRates(
  currentRate: number,
  previousRate: number | null,
): RateCompareTone {
  if (
    previousRate == null ||
    !Number.isFinite(previousRate) ||
    previousRate <= 0 ||
    !Number.isFinite(currentRate) ||
    currentRate <= 0
  ) {
    return "unknown";
  }
  if (currentRate < previousRate) {
    return "lower";
  }
  if (currentRate > previousRate) {
    return "higher";
  }
  return "same";
}

function rateCompareClass(tone: RateCompareTone): string {
  switch (tone) {
    case "lower":
      return "text-[var(--status-success)]";
    case "higher":
      return "text-[var(--status-error)]";
    case "same":
      return "text-foreground";
    default:
      return "text-muted-foreground";
  }
}

function LockTagsGroupSerialPreview({
  prId,
  items,
}: {
  prId: string;
  items: ApprovedPRLineItemRow[];
}) {
  const lockTagsQty = lockTagsQtyFromLineItems(items);
  const [preview, setPreview] = React.useState<LockTagsSerialPreview | null>(null);
  const itemKey = items.map((item) => item.prLineItemId).join(",");

  React.useEffect(() => {
    if (lockTagsQty <= 0) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    void getLockTagsSerialPreviewForPRItems(
      prId,
      items.map((item) => item.prLineItemId),
    ).then((result) => {
      if (!cancelled) {
        setPreview(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [prId, itemKey, lockTagsQty, items]);

  if (lockTagsQty <= 0 || !preview) {
    return null;
  }

  return (
    <div className="rounded-lg border border-dashed border-border-subtle bg-muted/20 p-3 text-ds-sm">
      <p className="font-medium">Lock tag serial reservation</p>
      <p className="mt-1 text-ds-xs text-muted-foreground">
        {preview.isHeld
          ? `Committed from PR hold when this PO is created (${preview.quantity.toLocaleString("en-IN")} serials).`
          : `This PO will reserve ${preview.quantity.toLocaleString("en-IN")} serial numbers when created.`}
      </p>
      <p className="mt-2 font-mono text-ds-sm">
        {preview.rangeStart} → {preview.rangeEnd}
      </p>
    </div>
  );
}

function lineTotal(qty: number, unitPrice: number | null): number | null {
  if (unitPrice == null || !Number.isFinite(unitPrice) || unitPrice <= 0) {
    return null;
  }
  return qty * unitPrice;
}

export function CreatePOFromPRForm({
  pr,
  activeVendors,
}: {
  pr: ApprovedPRAwaitingPO;
  activeVendors: ActiveVendor[];
}) {
  const router = useRouter();
  const { isPending, run } = useServerMutation();
  const pendingItems = unassignedItems(pr.lineItems);
  const fulfilledItems = assignedItems(pr.lineItems);

  const [drafts, setDrafts] = React.useState<Record<string, ItemDraft>>(() =>
    Object.fromEntries(
      pendingItems.map((item) => [item.prLineItemId, { vendorId: "", unitPrice: "" }]),
    ),
  );
  const [groupDelivery, setGroupDelivery] = React.useState<Record<string, string>>({});
  const [groupGst, setGroupGst] = React.useState<Record<string, GroupGstDraft>>({});
  const [groupAdvance, setGroupAdvance] = React.useState<Record<string, GroupAdvanceDraft>>({});
  const [csvErrors, setCsvErrors] = React.useState<string | null>(null);
  const [compareItem, setCompareItem] = React.useState<ApprovedPRLineItemRow | null>(null);
  const [lockTagsConfirm, setLockTagsConfirm] = React.useState<{
    vendorId: string;
    vendorName: string;
    preview: LockTagsSerialPreview;
    payload: Parameters<typeof createPOFromPRGroup>[1];
  } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const vendorGroups = React.useMemo(() => {
    const groups = new Map<string, ApprovedPRLineItemRow[]>();
    for (const item of pendingItems) {
      const vendorId = drafts[item.prLineItemId]?.vendorId ?? "";
      if (!vendorId) {
        continue;
      }
      const list = groups.get(vendorId) ?? [];
      list.push(item);
      groups.set(vendorId, list);
    }
    return [...groups.entries()].map(([vendorId, items]) => ({
      vendorId,
      vendorName: activeVendors.find((v) => v.id === vendorId)?.businessName ?? vendorId,
      items,
    }));
  }, [pendingItems, drafts, activeVendors]);

  React.useEffect(() => {
    setGroupGst((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const { vendorId } of vendorGroups) {
        if (next[vendorId]) {
          continue;
        }
        const vendor = activeVendors.find((v) => v.id === vendorId);
        if (!vendor) {
          continue;
        }
        const applicable = defaultGstApplicableForVendor(vendor.gst);
        next[vendorId] = {
          gstApplicable: applicable,
          gstRatePercent: applicable ? String(defaultGstRatePercentForVendor(vendor.gst)) : "",
        };
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [vendorGroups, activeVendors]);

  function setDraft(
    prLineItemId: string,
    patch: Partial<ItemDraft>,
    catalogItemId?: string,
  ) {
    setDrafts((prev) => ({
      ...prev,
      [prLineItemId]: { ...prev[prLineItemId]!, ...patch },
    }));
    if (patch.vendorId && catalogItemId) {
      void linkCatalogItemVendor(catalogItemId, patch.vendorId);
    }
  }

  function executeCreatePO(payload: Parameters<typeof createPOFromPRGroup>[1]) {
    void run(
      () => createPOFromPRGroup(pr.id, payload),
      {
        refresh: false,
        onSuccess: (result) => {
          const poId =
            result && typeof result === "object" && "poId" in result
              ? (result as { poId?: string; fullyConverted?: boolean }).poId
              : undefined;
          const fullyConverted =
            result &&
            typeof result === "object" &&
            "fullyConverted" in result &&
            (result as { fullyConverted?: boolean }).fullyConverted;
          if (!poId) {
            toast.error("Could not create purchase order.");
            return;
          }
          toast.success(`Purchase order ${formatProcurementRef(poId)} created.`);
          setLockTagsConfirm(null);
          if (fullyConverted) {
            router.push(`/purchase-orders/${poId}`);
          } else {
            router.refresh();
          }
        },
        onError: (m) => toast.error(m),
      },
    );
  }

  async function submitGroup(vendorId: string, items: ApprovedPRLineItemRow[]) {
    const expectedDelivery = groupDelivery[vendorId] ?? "";
    const itemPrices = items.map((item) => ({
      prLineItemId: item.prLineItemId,
      unitPrice: Number(drafts[item.prLineItemId]?.unitPrice ?? 0),
    }));

    const allPricesFilled = itemPrices.every(
      (row) => Number.isFinite(row.unitPrice) && row.unitPrice > 0,
    );
    if (!allPricesFilled) {
      toast.error("Enter a unit price for each item in this vendor group.");
      return;
    }
    if (!expectedDelivery) {
      toast.error("Set expected delivery for this vendor group.");
      return;
    }

    const gstDraft = groupGst[vendorId] ?? {
      gstApplicable: false,
      gstRatePercent: "",
    };
    const gstValidated = validatePoGstInput(
      gstDraft.gstApplicable,
      gstDraft.gstApplicable ? Number(gstDraft.gstRatePercent) : null,
    );
    if (!gstValidated.ok) {
      toast.error(gstValidated.message);
      return;
    }

    const billingLines = itemPrices.map((row) => {
      const item = items.find((i) => i.prLineItemId === row.prLineItemId)!;
      return { orderedQty: item.quantity, unitPrice: row.unitPrice };
    });
    const committedTotal = computePoOrderBilling(
      billingLines,
      gstDraft.gstApplicable,
      gstValidated.rate != null ? String(gstValidated.rate) : null,
    ).total;

    const advanceDraft = groupAdvance[vendorId];
    let advanceRequest:
      | { amount?: number; percent?: number; reason: string }
      | null
      | undefined = undefined;
    if (advanceDraft?.enabled) {
      const reason = advanceDraft.reason.trim();
      if (!reason) {
        toast.error("Enter a reason for the advance payment request.");
        return;
      }
      const resolved = resolveAdvanceRequestAmount(committedTotal, {
        amount:
          advanceDraft.mode === "amount" && advanceDraft.amount
            ? Number(advanceDraft.amount)
            : undefined,
        percent:
          advanceDraft.mode === "percent" && advanceDraft.percent
            ? Number(advanceDraft.percent)
            : undefined,
      });
      if (!resolved.ok) {
        toast.error(resolved.message);
        return;
      }
      advanceRequest = {
        amount: advanceDraft.mode === "amount" ? resolved.amount : undefined,
        percent: advanceDraft.mode === "percent" ? resolved.percent ?? undefined : undefined,
        reason,
      };
    }

    const payload = {
      vendorId,
      expectedDelivery,
      itemPrices,
      gstApplicable: gstDraft.gstApplicable,
      gstRatePercent: gstValidated.rate,
      advanceRequest: advanceRequest ?? null,
    };

    const lockTagsQty = lockTagsQtyFromLineItems(items);
    if (lockTagsQty > 0) {
      const preview = await getLockTagsSerialPreviewForPRItems(
        pr.id,
        items.map((item) => item.prLineItemId),
      );
      if (!preview) {
        toast.error("Could not preview lock tag serial range.");
        return;
      }
      const vendorName =
        activeVendors.find((v) => v.id === vendorId)?.businessName ?? vendorId;
      setLockTagsConfirm({ vendorId, vendorName, preview, payload });
      return;
    }

    executeCreatePO(payload);
  }

  async function downloadRateCsv() {
    const ids = pendingItems.map((item) => item.prLineItemId);
    const result = await exportPORateCsvForPR(pr.id, ids);
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
    const result = await validatePORateCsvForPR(pr.id, text, pendingItems.map((i) => i.prLineItemId));
    if (!result.ok) {
      setCsvErrors(result.message ?? "CSV validation failed.");
      return;
    }
    setCsvErrors(null);
    setDrafts((prev) => {
      const next = { ...prev };
      for (const row of result.itemPrices) {
        next[row.prLineItemId] = {
          vendorId: next[row.prLineItemId]?.vendorId ?? "",
          unitPrice: String(row.unitPrice),
        };
      }
      return next;
    });
    toast.success("Rates applied from CSV.");
  }

  function applyVendorFromCompare(
    item: ApprovedPRLineItemRow,
    vendorId: string,
    lastRate: string | null,
  ) {
    setDraft(
      item.prLineItemId,
      {
        vendorId,
        ...(lastRate != null && Number.isFinite(Number(lastRate))
          ? { unitPrice: String(Number(lastRate)) }
          : {}),
      },
      item.catalogItemId,
    );
    setCompareItem(null);
    if (lastRate != null && Number.isFinite(Number(lastRate))) {
      toast.success(`Vendor assigned with last rate ${formatInr(lastRate)}.`);
    } else {
      toast.success("Vendor assigned.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-ds surface-glow">
        <p className="text-ds-sm font-medium">
          {formatPrPageTitle({
            id: pr.id,
            categoryName: pr.categoryName,
            subcategoryName: pr.subcategoryName,
          })}
        </p>
        <p className="mt-1 text-ds-xs text-muted-foreground">
          {pr.lineSummary} · {pr.warehouseName}
        </p>
        <p className="mt-2 text-ds-sm font-medium tabular-nums">
          {pr.poProgress.assigned} of {pr.poProgress.total} catalog items on purchase orders
          {pr.quantity !== pr.poProgress.total ? (
            <span className="font-normal text-muted-foreground">
              {" "}
              · {formatUnitCount(pr.quantity)} on request
            </span>
          ) : null}
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

      {pr.existingPurchaseOrders.length > 0 ? (
        <section className="space-y-2 rounded-2xl border border-border-subtle bg-card p-4 shadow-ds surface-glow">
          <h2 className="text-ds-sm font-semibold">Purchase orders created</h2>
          <ul className="divide-y divide-border-subtle text-ds-sm">
            {pr.existingPurchaseOrders.map((po) => (
              <li key={po.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <div>
                  <ProcurementRefLink id={po.id} className="font-medium" />
                  <span className="text-muted-foreground"> · {po.vendorName}</span>
                  <span className="block text-ds-xs text-muted-foreground">
                    {formatOrderTotalsInline(po.itemCount, po.orderedQty)} ·{" "}
                    {formatDateMedium(po.createdAt)}
                  </span>
                </div>
                <Link href={`/purchase-orders/${po.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  View
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {fulfilledItems.length > 0 ? (
        <section className="space-y-2 rounded-2xl border border-border-subtle bg-muted/20 p-4">
          <h2 className="text-ds-sm font-semibold">Already on PO</h2>
          <ul className="space-y-1 text-ds-sm text-muted-foreground">
            {fulfilledItems.map((item) => (
              <li key={item.prLineItemId} className="flex items-center justify-between gap-2">
                <span>
                  {item.lineNumber}.{item.lineItemNumber} · {item.itemName}
                </span>
                {item.existingPoId ? (
                  <ProcurementRefLink id={item.existingPoId} className="text-ds-xs" />
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {pendingItems.length > 0 ? (
        <>
          <section className="space-y-4 rounded-2xl border border-border-subtle bg-card p-4 shadow-ds surface-glow">
            <div>
              <h2 className="text-ds-sm font-semibold">Unassigned items</h2>
              <p className="text-ds-xs text-muted-foreground">
                Assign each item to a vendor, enter rates, then create a PO per vendor group.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => void downloadRateCsv()}>
                Download rate CSV
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => fileInputRef.current?.click()}>
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
            {csvErrors ? <p className="text-ds-xs text-[var(--status-error)]">{csvErrors}</p> : null}

            <div className="overflow-x-auto rounded-md border border-border-subtle">
              <table className="w-full table-fixed text-ds-sm">
                <colgroup>
                  <col className="w-[4.5rem]" />
                  <col />
                  <col className="w-[5rem]" />
                  <col className="w-[12rem]" />
                  <col className="w-[6.5rem]" />
                  <col className="w-[6.5rem]" />
                  <col className="w-[7.5rem]" />
                  <col className="w-[7.5rem]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-border-subtle bg-muted/30 text-left text-ds-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Line</th>
                    <th className="px-3 py-2 font-medium">Item</th>
                    <th className="px-3 py-2 font-medium text-right">Qty</th>
                    <th className="px-3 py-2 font-medium">Vendor</th>
                    <th className="px-3 py-2 font-medium text-right">Last rate</th>
                    <th className="px-3 py-2 font-medium text-right">Rate (₹)</th>
                    <th className="px-3 py-2 font-medium text-right">Last value</th>
                    <th className="px-3 py-2 font-medium text-right">Current value</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingItems.map((item) => {
                    const currentRate = Number(drafts[item.prLineItemId]?.unitPrice ?? 0);
                    const previousRate =
                      item.previousUnitPrice != null
                        ? Number(item.previousUnitPrice)
                        : null;
                    const rateTone = compareUnitRates(currentRate, previousRate);
                    const lastValue = lineTotal(item.quantity, previousRate);
                    const currentValue = lineTotal(
                      item.quantity,
                      Number.isFinite(currentRate) && currentRate > 0 ? currentRate : null,
                    );

                    return (
                    <tr key={item.prLineItemId} className="border-b border-border-subtle last:border-0">
                      <td className="px-3 py-2 tabular-nums">
                        {item.lineNumber}.{item.lineItemNumber}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-medium">{item.itemName}</span>
                        <span className="block text-ds-xs text-muted-foreground">{item.unit}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                      <td className="px-3 py-2">
                        <Combobox
                          value={drafts[item.prLineItemId]?.vendorId ?? ""}
                          onChange={(vendorId) =>
                            setDraft(item.prLineItemId, { vendorId }, item.catalogItemId)
                          }
                          options={activeVendors.map((v) => ({
                            value: v.id,
                            label: v.businessName,
                          }))}
                          placeholder="Select vendor"
                          searchPlaceholder="Search vendors…"
                          emptyText="No vendors match"
                          ariaLabel={`Vendor for ${item.itemName}`}
                          size="sm"
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {formatInr(item.previousUnitPrice)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={drafts[item.prLineItemId]?.unitPrice ?? ""}
                            onChange={(e) =>
                              setDraft(item.prLineItemId, { unitPrice: e.target.value })
                            }
                            className={cn(
                              "h-8 w-[88px] text-right tabular-nums font-medium",
                              rateTone !== "unknown" && rateCompareClass(rateTone),
                            )}
                            aria-label={`Unit price for ${item.itemName}`}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Compare vendors for ${item.itemName}`}
                            onClick={() => setCompareItem(item)}
                          >
                            <GitCompare className="size-3.5" strokeWidth={1.5} aria-hidden />
                          </Button>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {lastValue != null ? formatInr(lastValue) : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right tabular-nums font-medium",
                          currentValue != null
                            ? rateCompareClass(rateTone)
                            : "text-muted-foreground",
                        )}
                      >
                        {currentValue != null ? formatInr(currentValue) : "—"}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {vendorGroups.map((group) => {
            const vendor = activeVendors.find((v) => v.id === group.vendorId);
            const gstDraft = groupGst[group.vendorId] ?? {
              gstApplicable: defaultGstApplicableForVendor(vendor?.gst),
              gstRatePercent: defaultGstApplicableForVendor(vendor?.gst)
                ? String(defaultGstRatePercentForVendor(vendor?.gst))
                : "",
            };
            const advanceDraft = groupAdvance[group.vendorId] ?? {
              enabled: false,
              mode: "amount" as const,
              amount: "",
              percent: "",
              reason: "",
            };
            const gstValidatedPreview = validatePoGstInput(
              gstDraft.gstApplicable,
              gstDraft.gstApplicable ? Number(gstDraft.gstRatePercent) : null,
            );
            const committedPreview =
              gstValidatedPreview.ok
                ? computePoOrderBilling(
                    group.items.map((item) => ({
                      orderedQty: item.quantity,
                      unitPrice: Number(drafts[item.prLineItemId]?.unitPrice ?? 0),
                    })),
                    gstDraft.gstApplicable,
                    gstValidatedPreview.rate != null
                      ? String(gstValidatedPreview.rate)
                      : null,
                  ).total
                : null;
            const advancePreview =
              advanceDraft.enabled && committedPreview != null
                ? resolveAdvanceRequestAmount(committedPreview, {
                    amount:
                      advanceDraft.mode === "amount" && advanceDraft.amount
                        ? Number(advanceDraft.amount)
                        : undefined,
                    percent:
                      advanceDraft.mode === "percent" && advanceDraft.percent
                        ? Number(advanceDraft.percent)
                        : undefined,
                  })
                : null;
            return (
            <section
              key={group.vendorId}
              className="space-y-4 rounded-2xl border border-border-subtle bg-card p-4 shadow-ds surface-glow"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-ds-sm font-semibold">{group.vendorName}</h2>
                  <p className="text-ds-xs text-muted-foreground">
                    {group.items.length} item(s) in this vendor group
                  </p>
                  {vendor?.gst ? (
                    <p className="mt-1 font-mono text-ds-xs text-muted-foreground">
                      Vendor GSTIN: {vendor.gst}
                    </p>
                  ) : (
                    <p className="mt-1 text-ds-xs text-muted-foreground">
                      No GSTIN on vendor record
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-ds-xs font-medium">Expected delivery</label>
                  <Input
                    type="date"
                    value={groupDelivery[group.vendorId] ?? ""}
                    onChange={(e) =>
                      setGroupDelivery((prev) => ({
                        ...prev,
                        [group.vendorId]: e.target.value,
                      }))
                    }
                    className="h-8"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border-subtle bg-muted/20 p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-ds-sm font-medium">GST purchase basis</p>
                    <p className="text-ds-xs text-muted-foreground">
                      Unit prices are exclusive of tax; GST is added when enabled.
                    </p>
                  </div>
                  <Switch
                    checked={gstDraft.gstApplicable}
                    onCheckedChange={(checked) =>
                      setGroupGst((prev) => ({
                        ...prev,
                        [group.vendorId]: {
                          gstApplicable: checked,
                          gstRatePercent: checked
                            ? prev[group.vendorId]?.gstRatePercent ||
                              String(defaultGstRatePercentForVendor(vendor?.gst))
                            : "",
                        },
                      }))
                    }
                    aria-label="GST applicable on this purchase order"
                  />
                </div>
                {gstDraft.gstApplicable ? (
                  <div className="space-y-1.5 max-w-[200px]">
                    <label className="text-ds-xs font-medium">GST rate (%)</label>
                    <Select
                      value={gstDraft.gstRatePercent || undefined}
                      onValueChange={(value) =>
                        setGroupGst((prev) => ({
                          ...prev,
                          [group.vendorId]: {
                            ...gstDraft,
                            gstRatePercent: value,
                          },
                        }))
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Select rate" />
                      </SelectTrigger>
                      <SelectContent>
                        {STANDARD_GST_RATES.filter((r) => r > 0).map((rate) => (
                          <SelectItem key={rate} value={String(rate)}>
                            {rate}%
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg border border-border-subtle bg-muted/20 p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-ds-sm font-medium">Request advance payment</p>
                    <p className="text-ds-xs text-muted-foreground">
                      Optional. Finance pays after the PO is created.
                      {committedPreview != null
                        ? ` Committed PO value (incl. GST when enabled): ${formatInr(committedPreview)}.`
                        : ""}
                    </p>
                  </div>
                  <Switch
                    checked={advanceDraft.enabled}
                    onCheckedChange={(checked) =>
                      setGroupAdvance((prev) => ({
                        ...prev,
                        [group.vendorId]: {
                          ...advanceDraft,
                          enabled: checked,
                        },
                      }))
                    }
                    aria-label="Request advance payment for this purchase order"
                  />
                </div>
                {advanceDraft.enabled ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={advanceDraft.mode === "amount" ? "default" : "outline"}
                        onClick={() =>
                          setGroupAdvance((prev) => ({
                            ...prev,
                            [group.vendorId]: { ...advanceDraft, mode: "amount", percent: "" },
                          }))
                        }
                      >
                        Fixed amount
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={advanceDraft.mode === "percent" ? "default" : "outline"}
                        onClick={() =>
                          setGroupAdvance((prev) => ({
                            ...prev,
                            [group.vendorId]: { ...advanceDraft, mode: "percent", amount: "" },
                          }))
                        }
                      >
                        % of PO
                      </Button>
                    </div>
                    {advanceDraft.mode === "amount" ? (
                      <div className="space-y-1.5 max-w-[200px]">
                        <label className="text-ds-xs font-medium">Advance amount (₹)</label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={advanceDraft.amount}
                          onChange={(e) =>
                            setGroupAdvance((prev) => ({
                              ...prev,
                              [group.vendorId]: { ...advanceDraft, amount: e.target.value },
                            }))
                          }
                          className="h-8"
                        />
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-w-[200px]">
                        <label className="text-ds-xs font-medium">Advance (%)</label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={advanceDraft.percent}
                          onChange={(e) =>
                            setGroupAdvance((prev) => ({
                              ...prev,
                              [group.vendorId]: { ...advanceDraft, percent: e.target.value },
                            }))
                          }
                          className="h-8"
                        />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label className="text-ds-xs font-medium">Reason (required)</label>
                      <Textarea
                        value={advanceDraft.reason}
                        onChange={(e) =>
                          setGroupAdvance((prev) => ({
                            ...prev,
                            [group.vendorId]: { ...advanceDraft, reason: e.target.value },
                          }))
                        }
                        rows={2}
                        placeholder="Why is advance needed before delivery or invoicing?"
                      />
                    </div>
                    {advancePreview && !advancePreview.ok ? (
                      <p className="text-ds-xs text-status-error">{advancePreview.message}</p>
                    ) : null}
                    {advancePreview && advancePreview.ok ? (
                      <p className="text-ds-xs text-muted-foreground">
                        Request preview: {formatInr(advancePreview.amount)}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <LockTagsGroupSerialPreview
                prId={pr.id}
                items={group.items}
              />

              <Button
                type="button"
                disabled={isPending}
                onClick={() => void submitGroup(group.vendorId, group.items)}
              >
                Create PO for {group.vendorName}
              </Button>
            </section>
            );
          })}
        </>
      ) : (
        <p className="text-ds-sm text-muted-foreground">
          All line items are on purchase orders.{" "}
          <Link href={`/purchase-requests/${pr.id}`} className="text-primary underline-offset-4 hover:underline">
            View purchase request
          </Link>
        </p>
      )}

      <ConfirmDialog
        open={lockTagsConfirm != null}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setLockTagsConfirm(null);
          }
        }}
        title="Reserve lock tag serial range?"
        closeOnConfirm={false}
        pending={isPending}
        confirmLabel="Reserve range and create PO"
        body={
          lockTagsConfirm ? (
            <div className="space-y-2">
              <p>
                Creating a PO for {lockTagsConfirm.vendorName} will atomically reserve{" "}
                {lockTagsConfirm.preview.quantity.toLocaleString("en-IN")} lock tag serial
                numbers:
              </p>
              <p className="font-mono font-medium text-foreground">
                {lockTagsConfirm.preview.rangeStart} → {lockTagsConfirm.preview.rangeEnd}
              </p>
              <p>
                Share this range with the vendor for printing. If reservation fails, the PO
                will not be created.
              </p>
            </div>
          ) : null
        }
        onConfirm={() => {
          if (lockTagsConfirm) {
            executeCreatePO(lockTagsConfirm.payload);
          }
        }}
      />

      <VendorItemComparisonDrawer
        open={compareItem != null}
        onOpenChange={(open) => {
          if (!open) {
            setCompareItem(null);
          }
        }}
        catalogItemId={compareItem?.catalogItemId ?? null}
        itemName={compareItem?.itemName ?? ""}
        sku={compareItem?.sku}
        unit={compareItem?.unit}
        activeVendors={activeVendors}
        onApplyVendor={
          compareItem
            ? (vendorId, lastRate) =>
                applyVendorFromCompare(compareItem, vendorId, lastRate)
            : undefined
        }
      />
    </div>
  );
}

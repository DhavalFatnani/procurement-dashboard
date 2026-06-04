"use client";

import { GitCompare } from "lucide-react";
import * as React from "react";

import { fetchVendorComparisonForCatalogItem } from "@/app/actions/vendor-items";
import { ProcurementRefLink } from "@/components/shared/ProcurementRef";
import { Chip } from "@/components/shared/Chip";
import { DrawerShell } from "@/components/shared/Drawer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatInr, formatDateMedium } from "@/lib/format-datetime";
import type { VendorItemComparisonRow } from "@/lib/queries/vendor-items";
import { cn } from "@/lib/utils";

function comparisonDescription(item: {
  itemName: string;
  sku: string | null;
  unit: string;
}): string {
  const parts = [item.itemName];
  const meta = [item.sku, item.unit].filter(Boolean).join(" · ");
  if (meta) {
    parts.push(meta);
  }
  return parts.join(" · ");
}

function lowestPriceVendorIds(rows: VendorItemComparisonRow[]): Set<string> {
  const withPrice = rows
    .map((row) => ({
      vendorId: row.vendorId,
      price: row.latestPrice != null ? Number(row.latestPrice) : NaN,
    }))
    .filter((row) => Number.isFinite(row.price));

  if (withPrice.length < 2) {
    return new Set();
  }

  const min = Math.min(...withPrice.map((row) => row.price));
  return new Set(
    withPrice.filter((row) => row.price === min).map((row) => row.vendorId),
  );
}

function VendorCardSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border border-border-subtle bg-card p-4">
      <Skeleton className="h-4 w-2/5" />
      <Skeleton className="h-7 w-1/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

function VendorComparisonCard({
  row,
  isLowest,
  onApply,
}: {
  row: VendorItemComparisonRow;
  isLowest: boolean;
  onApply: () => void;
}) {
  return (
    <article
      className={cn(
        "space-y-3 rounded-xl border border-border-subtle bg-card p-4 shadow-ds",
        isLowest && "border-[var(--brand-accent)]/40 ring-1 ring-[var(--brand-accent)]/20",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-ds-sm font-semibold">{row.vendorName}</h3>
        {isLowest ? (
          <Chip tone="success" size="sm">
            Lowest
          </Chip>
        ) : null}
      </div>

      <p className="text-ds-lg font-semibold tabular-nums tracking-tight">
        {formatInr(row.latestPrice)}
        <span className="ml-1 text-ds-xs font-normal text-muted-foreground">last price</span>
      </p>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-ds-xs text-muted-foreground">
        <div>
          <dt className="sr-only">Price range</dt>
          <dd>
            {row.minPrice && row.maxPrice
              ? `${formatInr(row.minPrice)} – ${formatInr(row.maxPrice)}`
              : "—"}
          </dd>
        </div>
        <div className="text-right">
          <dt className="sr-only">Quotes recorded</dt>
          <dd>
            {row.quoteCount} quote{row.quoteCount === 1 ? "" : "s"}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="sr-only">Last seen</dt>
          <dd>
            {row.lastRecordedAt ? formatDateMedium(row.lastRecordedAt) : "No date recorded"}
          </dd>
        </div>
      </dl>

      {row.lastPoId ? (
        <p className="text-ds-xs text-muted-foreground">
          Last PO{" "}
          <ProcurementRefLink id={row.lastPoId} className="font-medium text-foreground" />
        </p>
      ) : null}

      <Button type="button" className="w-full" size="sm" onClick={onApply}>
        Use this vendor
      </Button>
    </article>
  );
}

function ActiveVendorCard({
  vendorName,
  onApply,
}: {
  vendorName: string;
  onApply: () => void;
}) {
  return (
    <article className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-card p-4">
      <span className="text-ds-sm font-medium">{vendorName}</span>
      <Button type="button" variant="outline" size="sm" onClick={onApply}>
        Assign
      </Button>
    </article>
  );
}

export function VendorItemComparisonDrawer({
  open,
  onOpenChange,
  catalogItemId,
  itemName,
  sku,
  unit,
  activeVendors,
  onApplyVendor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogItemId: string | null;
  itemName: string;
  sku?: string | null;
  unit?: string;
  activeVendors: { id: string; businessName: string }[];
  onApplyVendor?: (vendorId: string, lastRate: string | null) => void;
}) {
  const [rows, setRows] = React.useState<VendorItemComparisonRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open || !catalogItemId) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchVendorComparisonForCatalogItem(catalogItemId).then((data) => {
      if (!cancelled) {
        setRows(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, catalogItemId]);

  const lowestIds = React.useMemo(() => lowestPriceVendorIds(rows), [rows]);

  function applyVendor(vendorId: string, lastRate: string | null) {
    onApplyVendor?.(vendorId, lastRate);
    onOpenChange(false);
  }

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title="Compare vendors"
      description={comparisonDescription({
        itemName,
        sku: sku ?? null,
        unit: unit ?? "pcs",
      })}
      width="lg"
    >
      <div className="space-y-4 px-5 py-5">
        {loading ? (
          <div className="space-y-3">
            <VendorCardSkeleton />
            <VendorCardSkeleton />
          </div>
        ) : rows.length > 0 ? (
          <div className="space-y-3">
            {rows.map((row) => (
              <VendorComparisonCard
                key={row.vendorId}
                row={row}
                isLowest={lowestIds.has(row.vendorId)}
                onApply={() => applyVendor(row.vendorId, row.latestPrice)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-dashed border-border-subtle bg-muted/20 px-4 py-6 text-center">
              <GitCompare
                className="mx-auto mb-3 size-8 text-muted-foreground/60"
                strokeWidth={1.5}
                aria-hidden
              />
              <p className="text-ds-sm font-medium">No vendor history yet</p>
              <p className="mt-1 text-ds-xs text-muted-foreground">
                Assign a vendor to start building price history for this item.
              </p>
            </div>
            {activeVendors.length > 0 ? (
              <div className="space-y-2">
                <p className="text-ds-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Active vendors
                </p>
                {activeVendors.map((vendor) => (
                  <ActiveVendorCard
                    key={vendor.id}
                    vendorName={vendor.businessName}
                    onApply={() => applyVendor(vendor.id, null)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}

        <p className="text-ds-xs text-muted-foreground">
          Price is a reference — confirm the current quote in the Rate field before creating the PO.
        </p>
      </div>
    </DrawerShell>
  );
}

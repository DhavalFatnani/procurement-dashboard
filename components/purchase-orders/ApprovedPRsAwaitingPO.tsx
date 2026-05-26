"use client";

import * as React from "react";

import { ProcurementRefLink } from "@/components/shared/ProcurementRef";
import type { ApprovedPRAwaitingPO } from "@/lib/queries/purchase-orders";
import { CreatePOFromPRPanel } from "@/components/purchase-orders/CreatePOFromPRPanel";
import { formatPrPageTitle } from "@/lib/display-ref";
import { formatDateMedium } from "@/lib/format-datetime";

type ActiveVendor = { id: string; businessName: string };

export function ApprovedPRsAwaitingPO({
  rows,
  activeVendors,
  fulfillPrId,
}: {
  rows: ApprovedPRAwaitingPO[];
  activeVendors: ActiveVendor[];
  fulfillPrId?: string;
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-border-subtle bg-card p-4 shadow-ds surface-glow">
      <div className="mb-3">
        <h2 className="text-ds-sm font-semibold">Approved requests — create purchase order</h2>
        <p className="text-ds-xs text-muted-foreground">
          Select vendor, unit price, and expected delivery before issuing a PO.
        </p>
      </div>
      <ul className="divide-y divide-border-subtle">
        {rows.map((pr) => (
          <li key={pr.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1 text-ds-sm">
              <p className="font-medium">
                <ProcurementRefLink id={pr.id} className="text-ds-sm font-medium" />
                <span className="text-muted-foreground">
                  {" "}
                  · {formatPrPageTitle({
                    id: pr.id,
                    categoryName: pr.categoryName,
                    subcategoryName: pr.subcategoryName,
                  })}
                </span>
              </p>
              <p className="text-muted-foreground">Qty {pr.quantity}</p>
              <p className="text-ds-xs text-muted-foreground">
                {pr.warehouseName} · {pr.createdByName} · {formatDateMedium(pr.createdAt)}
              </p>
              {pr.vendorRequestLabel ? (
                <p className="text-ds-xs text-status-warning">Vendor request: {pr.vendorRequestLabel}</p>
              ) : null}
            </div>
            <CreatePOFromPRPanel
              pr={pr}
              activeVendors={activeVendors}
              defaultOpen={fulfillPrId === pr.id}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

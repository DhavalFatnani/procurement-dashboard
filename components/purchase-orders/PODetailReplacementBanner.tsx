"use client";

import Link from "next/link";

import {
  SurfaceCard,
  SurfaceCardDescription,
  SurfaceCardTitle,
} from "@/components/shared/SurfaceCard";
import { buttonVariants } from "@/components/ui/button";
import type { PODetail } from "@/lib/queries/purchase-orders";

export function PODetailReplacementBanner({ po }: { po: PODetail }) {
  if (po.pendingReplacements.length === 0) {
    return null;
  }

  return (
    <SurfaceCard
      header={
        <>
          <SurfaceCardTitle>Awaiting replacement GRN</SurfaceCardTitle>
          <SurfaceCardDescription>
            Record replacement receipts before invoicing this PO.
          </SurfaceCardDescription>
        </>
      }
    >
      <ul className="space-y-2 text-ds-sm">
        {po.pendingReplacements.map((row) => (
          <li key={row.poLineItemId} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {row.label} — <span className="font-tabular">{row.pendingQty}</span> units
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <Link
          href={`/goods-receipt/new?poId=${po.id}`}
          className={buttonVariants({ size: "sm" })}
        >
          Record replacement GRN
        </Link>
      </div>
    </SurfaceCard>
  );
}

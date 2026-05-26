import Link from "next/link";

import { Avatar } from "@/components/shared/Avatar";
import { Chip } from "@/components/shared/Chip";
import { ProcurementRefText } from "@/components/shared/ProcurementRef";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatPoPageTitle } from "@/lib/display-ref";
import { formatDateMedium, formatInr } from "@/lib/format-datetime";
import type { PODetail } from "@/lib/queries/purchase-orders";

/**
 * Slim PO detail hero — identity only. No CTAs (those live in the sticky
 * action bar), no progress bar (that lives in the side panel).
 */
export function PODetailHero({ po }: { po: PODetail }) {
  const totalValue = po.lines.reduce(
    (sum, line) => sum + line.orderedQty * Number(line.unitPrice),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-ds-xs text-muted-foreground">
        <ProcurementRefText id={po.id} />
        <Chip tone="neutral" size="sm">
          PR{" "}
          <Link
            href={`/purchase-requests/${po.prId}`}
            className="ml-1 underline"
          >
            {po.prId.slice(-8).toUpperCase()}
          </Link>
        </Chip>
        <StatusBadge kind="POStatus" status={po.status} />
        {po.expectedDelivery ? (
          <span>Expected {formatDateMedium(po.expectedDelivery)}</span>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <h1 className="text-ds-xl font-semibold tracking-tight text-foreground">
          {formatPoPageTitle({
            id: po.id,
            vendorName: po.vendor.businessName,
          })}
        </h1>
        <p className="text-ds-sm text-muted-foreground">
          {po.lineSummary} · {po.orderedQty} ordered · Value{" "}
          {formatInr(String(totalValue))}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-ds-sm">
        <span className="inline-flex items-center gap-2">
          <Avatar name={po.vendor.businessName} size="sm" />
          <span className="font-medium text-foreground">
            {po.vendor.businessName}
          </span>
        </span>
        <span className="text-muted-foreground">{po.vendor.pocName}</span>
        <span className="text-muted-foreground">{po.vendor.phone}</span>
        <Link
          href={`/vendors/${po.vendor.id}`}
          className="text-ds-xs text-primary hover:underline"
        >
          View vendor →
        </Link>
      </div>
    </div>
  );
}

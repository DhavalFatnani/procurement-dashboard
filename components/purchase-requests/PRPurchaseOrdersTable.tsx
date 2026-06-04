import Link from "next/link";

import { ProcurementRefLink } from "@/components/shared/ProcurementRef";
import {
  SurfaceCard,
  SurfaceCardDescription,
  SurfaceCardTitle,
} from "@/components/shared/SurfaceCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatDateMedium } from "@/lib/format-datetime";
import type { PRDetail } from "@/lib/queries/purchase-requests";
import { cn } from "@/lib/utils";

export function PRPurchaseOrdersTable({
  prId,
  purchaseOrders,
  showConfigureLink = false,
}: {
  prId: string;
  purchaseOrders: PRDetail["purchaseOrders"];
  showConfigureLink?: boolean;
}) {
  return (
    <SurfaceCard
      header={
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SurfaceCardTitle>Purchase orders</SurfaceCardTitle>
            <SurfaceCardDescription>
              {purchaseOrders.length === 0
                ? "No purchase orders have been created from this request yet."
                : `${purchaseOrders.length} purchase order${purchaseOrders.length === 1 ? "" : "s"} issued from this PR.`}
            </SurfaceCardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {purchaseOrders.length > 0 ? (
              <Link
                href={`/purchase-orders?${new URLSearchParams({ prId }).toString()}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                View in PO list
              </Link>
            ) : null}
            {showConfigureLink ? (
              <Button
                size="sm"
                render={
                  <Link href={`/purchase-orders/configure/${encodeURIComponent(prId)}`} />
                }
              >
                Configure PO
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      {purchaseOrders.length === 0 ? (
        <p className="text-ds-sm text-muted-foreground">
          Once Ops configures a purchase order, it will appear here with status and links to
          fulfillment.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-ds-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left text-ds-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Reference</th>
                <th className="py-2 pr-4 font-medium">Vendor</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium text-right">Catalog items</th>
                <th className="py-2 pr-4 font-medium text-right">Total units</th>
                <th className="py-2 pr-4 font-medium">Invoice</th>
                <th className="py-2 pr-4 font-medium">Payment</th>
                <th className="py-2 pr-4 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.map((po) => (
                <tr
                  key={po.id}
                  className="border-b border-border-subtle last:border-0"
                >
                  <td className="py-3 pr-4">
                    <ProcurementRefLink id={po.id} className="font-medium" />
                  </td>
                  <td className="py-3 pr-4">{po.vendorName}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge kind="POStatus" status={po.status} />
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">{po.itemCount}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{po.orderedQty}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge kind="InvoiceMatchStatus" status={po.invoiceMatchStatus} />
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge kind="PaymentStatus" status={po.paymentStatus} />
                  </td>
                  <td className="py-3 pr-4 text-ds-xs text-muted-foreground">
                    {formatDateMedium(po.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SurfaceCard>
  );
}

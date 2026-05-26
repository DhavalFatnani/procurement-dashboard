import type { BreadcrumbIconId, BreadcrumbItem } from "@/lib/breadcrumbs";
import { formatProcurementRef } from "@/lib/display-ref";

const MODULE_LABELS: Record<string, { label: string; icon: BreadcrumbIconId }> = {
  "/inbox": { label: "Inbox", icon: "inbox" },
  "/dashboard": { label: "Dashboard", icon: "dashboard" },
  "/purchase-requests": { label: "Purchase Requests", icon: "purchaseRequests" },
  "/purchase-orders": { label: "Purchase Orders", icon: "purchaseOrders" },
  "/goods-receipt": { label: "Goods Receipt", icon: "goodsReceipt" },
  "/invoices": { label: "Invoices", icon: "invoices" },
  "/payments": { label: "Payments", icon: "payments" },
  "/vendors": { label: "Vendors", icon: "vendors" },
  "/serial-governance": { label: "Serial Governance", icon: "serialGovernance" },
  "/reports": { label: "Reports", icon: "reports" },
};

function moduleCrumb(href: string): BreadcrumbItem {
  const meta = MODULE_LABELS[href];
  return {
    label: meta?.label ?? href,
    href,
    icon: meta?.icon,
  };
}

export function prDetailBreadcrumbs(prId: string): BreadcrumbItem[] {
  return [
    moduleCrumb("/purchase-requests"),
    { label: formatProcurementRef(prId), mono: true },
  ];
}

export function poDetailBreadcrumbs(input: {
  poId: string;
  prId?: string | null;
}): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [moduleCrumb("/purchase-orders")];
  if (input.prId) {
    items.push({
      label: formatProcurementRef(input.prId),
      href: `/purchase-requests/${input.prId}`,
      mono: true,
    });
  }
  items.push({ label: formatProcurementRef(input.poId), mono: true });
  return items;
}

export function invoiceDetailBreadcrumbs(input: {
  invoiceNumber: string;
  poId: string;
  prId?: string | null;
}): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [moduleCrumb("/invoices")];
  if (input.prId) {
    items.push({
      label: formatProcurementRef(input.prId),
      href: `/purchase-requests/${input.prId}`,
      mono: true,
    });
  }
  items.push({
    label: formatProcurementRef(input.poId),
    href: `/purchase-orders/${input.poId}`,
    mono: true,
  });
  items.push({ label: `INV-${input.invoiceNumber}`, mono: true });
  return items;
}

export function vendorDetailBreadcrumbs(name: string): BreadcrumbItem[] {
  return [moduleCrumb("/vendors"), { label: name }];
}

export function grnDetailBreadcrumbs(input: {
  grnId: string;
  poId: string;
}): BreadcrumbItem[] {
  return [
    moduleCrumb("/goods-receipt"),
    {
      label: formatProcurementRef(input.poId),
      href: `/purchase-orders/${input.poId}`,
      mono: true,
    },
    { label: input.grnId.slice(-8).toUpperCase(), mono: true },
  ];
}

export function listBreadcrumbs(href: string): BreadcrumbItem[] {
  return [moduleCrumb(href)];
}

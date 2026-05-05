import { Role } from "@prisma/client";

export type NavIconId =
  | "dashboard"
  | "vendors"
  | "purchaseRequests"
  | "purchaseOrders"
  | "goodsReceipt"
  | "invoices"
  | "payments"
  | "serialGovernance"
  | "reports";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconId;
};

export const ROLE_LABELS: Record<Role, string> = {
  [Role.SM]: "Store Manager",
  [Role.OPS_HEAD]: "Operations Head",
  [Role.FINANCE]: "Finance",
};

export function getNavItemsForRole(role: Role): NavItem[] {
  switch (role) {
    case Role.SM:
      return [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        { href: "/vendors", label: "Vendors (read-only)", icon: "vendors" },
        { href: "/purchase-requests", label: "Purchase Requests", icon: "purchaseRequests" },
        { href: "/purchase-orders", label: "Purchase Orders (read-only)", icon: "purchaseOrders" },
        { href: "/goods-receipt", label: "Goods Receipt", icon: "goodsReceipt" },
        { href: "/invoices", label: "Invoices (upload only)", icon: "invoices" },
        { href: "/serial-governance", label: "Serial Governance", icon: "serialGovernance" },
        { href: "/reports", label: "Reports (limited)", icon: "reports" },
      ];
    case Role.OPS_HEAD:
      return [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        { href: "/vendors", label: "Vendors", icon: "vendors" },
        { href: "/purchase-requests", label: "Purchase Requests", icon: "purchaseRequests" },
        { href: "/purchase-orders", label: "Purchase Orders", icon: "purchaseOrders" },
        { href: "/goods-receipt", label: "Goods Receipt", icon: "goodsReceipt" },
        { href: "/invoices", label: "Invoices", icon: "invoices" },
        { href: "/payments", label: "Payments (view only)", icon: "payments" },
        { href: "/serial-governance", label: "Serial Governance", icon: "serialGovernance" },
        { href: "/reports", label: "Reports (full)", icon: "reports" },
      ];
    case Role.FINANCE:
      return [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        {
          href: "/purchase-orders",
          label: "Purchase Orders (read-only, limited)",
          icon: "purchaseOrders",
        },
        { href: "/invoices", label: "Invoices", icon: "invoices" },
        { href: "/payments", label: "Payments", icon: "payments" },
        { href: "/reports", label: "Reports (payment only)", icon: "reports" },
      ];
  }
}

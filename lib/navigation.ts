import { Role } from "@prisma/client";

export type NavIconId =
  | "inbox"
  | "dashboard"
  | "vendors"
  | "purchaseRequests"
  | "purchaseOrders"
  | "goodsReceipt"
  | "invoices"
  | "payments"
  | "serialGovernance"
  | "reports"
  | "users"
  | "warehouses";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconId;
  /** Optional "(read-only)" / "(limited)" subtitle shown beneath the label. */
  hint?: string;
};

export type NavGroup = {
  id: "work" | "governance" | "insights" | "admin";
  label: string;
  items: NavItem[];
};

export const ROLE_LABELS: Record<Role, string> = {
  [Role.SM]: "Store Manager",
  [Role.OPS_HEAD]: "Operations Head",
  [Role.FINANCE]: "Finance",
};

const INBOX_ITEM: NavItem = {
  href: "/inbox",
  label: "Inbox",
  icon: "inbox",
};

function workItemsFor(role: Role): NavItem[] {
  switch (role) {
    case Role.SM:
      return [
        INBOX_ITEM,
        { href: "/purchase-requests", label: "Purchase Requests", icon: "purchaseRequests" },
        {
          href: "/purchase-orders",
          label: "Purchase Orders",
          icon: "purchaseOrders",
          hint: "read-only",
        },
        { href: "/goods-receipt", label: "Goods Receipt", icon: "goodsReceipt" },
        { href: "/invoices", label: "Invoices", icon: "invoices", hint: "upload only" },
      ];
    case Role.OPS_HEAD:
      return [
        INBOX_ITEM,
        { href: "/purchase-requests", label: "Purchase Requests", icon: "purchaseRequests" },
        { href: "/purchase-orders", label: "Purchase Orders", icon: "purchaseOrders" },
        { href: "/goods-receipt", label: "Goods Receipt", icon: "goodsReceipt" },
        { href: "/invoices", label: "Invoices", icon: "invoices" },
        { href: "/payments", label: "Payments", icon: "payments", hint: "view only" },
      ];
    case Role.FINANCE:
      return [
        INBOX_ITEM,
        {
          href: "/purchase-orders",
          label: "Purchase Orders",
          icon: "purchaseOrders",
          hint: "read-only",
        },
        { href: "/payments", label: "Invoices & payments", icon: "payments" },
      ];
  }
}

function governanceItemsFor(role: Role): NavItem[] {
  switch (role) {
    case Role.SM:
      return [
        { href: "/vendors", label: "Vendors", icon: "vendors", hint: "read-only" },
        { href: "/serial-governance", label: "Serial Governance", icon: "serialGovernance" },
      ];
    case Role.OPS_HEAD:
      return [
        { href: "/vendors", label: "Vendors", icon: "vendors" },
        { href: "/serial-governance", label: "Serial Governance", icon: "serialGovernance" },
      ];
    case Role.FINANCE:
      return [];
  }
}

function insightItemsFor(role: Role): NavItem[] {
  switch (role) {
    case Role.SM:
      return [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        { href: "/reports", label: "Reports", icon: "reports", hint: "limited" },
      ];
    case Role.OPS_HEAD:
      return [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        { href: "/reports", label: "Reports", icon: "reports" },
      ];
    case Role.FINANCE:
      return [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        { href: "/reports", label: "Reports", icon: "reports", hint: "payment only" },
      ];
  }
}

function adminItemsFor(role: Role): NavItem[] {
  if (role !== Role.OPS_HEAD) return [];
  return [
    { href: "/admin/users", label: "Users", icon: "users" },
    { href: "/admin/warehouses", label: "Warehouses", icon: "warehouses" },
  ];
}

export function getNavGroupsForRole(role: Role): NavGroup[] {
  const groups: NavGroup[] = [
    { id: "insights", label: "Insights", items: insightItemsFor(role) },
    { id: "work", label: "Work", items: workItemsFor(role) },
    { id: "governance", label: "Governance", items: governanceItemsFor(role) },
    { id: "admin", label: "Admin", items: adminItemsFor(role) },
  ];
  return groups.filter((group) => group.items.length > 0);
}

/** Flat list (preserved for callers that don't need grouping). */
export function getNavItemsForRole(role: Role): NavItem[] {
  return getNavGroupsForRole(role).flatMap((group) => group.items);
}

/**
 * Where each role lands after sign-in or when they hit `/`.
 *
 * All roles now land on `/dashboard` for a consistent home. Role-specific
 * working surfaces (inbox, payments queue) remain one click away in the
 * sidebar and as quick-action cards on the dashboard itself.
 */
export function defaultLandingFor(role: Role): string {
  switch (role) {
    case Role.SM:
    case Role.OPS_HEAD:
    case Role.FINANCE:
      return "/dashboard";
  }
}

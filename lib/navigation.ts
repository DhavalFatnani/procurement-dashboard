// See note in `types/index.ts`: import enums from the dependency-free `enums`
// module, not the `@/lib/prisma-client` barrel, so this file stays Edge-safe
// (middleware → `defaultLandingFor` pulls it into the Edge Runtime bundle).
import { Role } from "@/lib/generated/prisma/enums";

import { FINANCE_ROUTES } from "@/lib/finance-routes";

export type NavIconId =
  | "inbox"
  | "dashboard"
  | "vendors"
  | "purchaseRequests"
  | "configurePO"
  | "purchaseOrders"
  | "goodsReceipt"
  | "invoices"
  | "payments"
  | "serialGovernance"
  | "labelStudio"
  | "binLabels"
  | "reports"
  | "users"
  | "warehouses"
  | "catalog";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconId;
  /** Optional "(read-only)" / "(limited)" subtitle shown beneath the label. */
  hint?: string;
  /** Downstream steps from PO (GRN → invoices → payments). */
  children?: NavItem[];
};

export type NavGroup = {
  id: "payables" | "work" | "governance" | "insights" | "admin";
  label: string;
  items: NavItem[];
};

const PURCHASE_REQUESTS_ITEM: NavItem = {
  href: "/purchase-requests",
  label: "Purchase Requests",
  icon: "purchaseRequests",
};

const CONFIGURE_PO_ITEM: NavItem = {
  href: "/purchase-orders/configure",
  label: "Configure PO",
  icon: "configurePO",
};

const OPS_PO_FULFILLMENT_CHILDREN: NavItem[] = [
  { href: "/goods-receipt", label: "Goods Receipt", icon: "goodsReceipt" },
  { href: "/invoices", label: "Invoices", icon: "invoices" },
  {
    href: FINANCE_ROUTES.invoiceSettlement,
    label: "Payments",
    icon: "payments",
    hint: "view only",
  },
];

/** Flatten top-level and nested nav items (for command palette, tests). */
export function flattenNavItems(items: NavItem[]): NavItem[] {
  return items.flatMap((item) =>
    item.children ? [item, ...item.children] : [item],
  );
}

function poFulfillmentChildren(role: Role): NavItem[] {
  switch (role) {
    case Role.SM:
      return [
        {
          href: "/goods-receipt",
          label: "Goods Receipt",
          icon: "goodsReceipt",
        },
        {
          href: "/invoices",
          label: "Invoices",
          icon: "invoices",
          hint: "upload only",
        },
      ];
    case Role.CENTRAL_TEAM:
    case Role.OPS_HEAD:
      return OPS_PO_FULFILLMENT_CHILDREN;
    case Role.ADMIN:
      return [
        { href: "/goods-receipt", label: "Goods Receipt", icon: "goodsReceipt" },
        { href: "/invoices", label: "Invoices", icon: "invoices" },
        {
          href: FINANCE_ROUTES.invoiceSettlement,
          label: "Payments",
          icon: "payments",
        },
      ];
    case Role.FINANCE:
      return [];
  }
}

function purchaseOrdersHubFor(role: Role): NavItem {
  const children = poFulfillmentChildren(role);
  return {
    href: "/purchase-orders",
    label: "Purchase Orders",
    icon: "purchaseOrders",
    ...(role === Role.SM || role === Role.FINANCE
      ? { hint: "read-only" }
      : {}),
    ...(children.length > 0 ? { children } : {}),
  };
}

export const ROLE_LABELS: Record<Role, string> = {
  [Role.SM]: "Store Manager",
  [Role.CENTRAL_TEAM]: "Central Team",
  [Role.OPS_HEAD]: "Operations Head",
  [Role.FINANCE]: "Finance",
  [Role.ADMIN]: "Admin",
};

const INBOX_ITEM: NavItem = {
  href: "/inbox",
  label: "Inbox",
  icon: "inbox",
};

function payablesItemsFor(role: Role): NavItem[] {
  if (role !== Role.FINANCE && role !== Role.ADMIN) return [];
  return [
    ...(role === Role.FINANCE ? [INBOX_ITEM] : []),
    {
      href: FINANCE_ROUTES.invoiceSettlement,
      label: "Invoice settlement",
      icon: "invoices",
    },
    {
      href: FINANCE_ROUTES.vendorAdvances,
      label: "Vendor advances",
      icon: "payments",
    },
    {
      href: FINANCE_ROUTES.paymentRegister,
      label: "Payment register",
      icon: "payments",
    },
  ];
}

function workItemsFor(role: Role): NavItem[] {
  const poHub = purchaseOrdersHubFor(role);
  switch (role) {
    case Role.SM:
      return [INBOX_ITEM, PURCHASE_REQUESTS_ITEM, poHub];
    case Role.CENTRAL_TEAM:
    case Role.OPS_HEAD:
      return [INBOX_ITEM, PURCHASE_REQUESTS_ITEM, CONFIGURE_PO_ITEM, poHub];
    case Role.ADMIN:
      return [INBOX_ITEM, PURCHASE_REQUESTS_ITEM, CONFIGURE_PO_ITEM, poHub];
    case Role.FINANCE:
      return [poHub];
  }
}

function governanceItemsFor(role: Role): NavItem[] {
  switch (role) {
    case Role.SM:
      return [
        { href: "/vendors", label: "Vendors", icon: "vendors", hint: "read-only" },
        { href: "/serial-governance", label: "Serial Governance", icon: "serialGovernance" },
        { href: "/label-studio", label: "Label Studio", icon: "labelStudio" },
        { href: "/bin-labels/print", label: "Print bin labels", icon: "binLabels" },
      ];
    case Role.CENTRAL_TEAM:
    case Role.OPS_HEAD:
    case Role.ADMIN:
      return [
        { href: "/vendors", label: "Vendors", icon: "vendors" },
        { href: "/serial-governance", label: "Serial Governance", icon: "serialGovernance" },
        { href: "/label-studio", label: "Label Studio", icon: "labelStudio" },
        { href: "/bin-labels/print", label: "Print bin labels", icon: "binLabels" },
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
    case Role.CENTRAL_TEAM:
    case Role.OPS_HEAD:
    case Role.ADMIN:
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
  if (role === Role.CENTRAL_TEAM) {
    return [
      { href: "/admin/warehouses", label: "Warehouses", icon: "warehouses" },
      { href: "/admin/taxonomy", label: "Taxonomy", icon: "catalog" },
    ];
  }
  if (role === Role.OPS_HEAD) {
    return [
      { href: "/admin/users", label: "Users", icon: "users" },
      { href: "/admin/warehouses", label: "Warehouses", icon: "warehouses" },
      { href: "/admin/taxonomy", label: "Taxonomy", icon: "catalog" },
    ];
  }
  if (role === Role.ADMIN) {
    return [
      { href: "/admin/platform", label: "Platform control", icon: "dashboard" },
      { href: "/admin/users", label: "Users", icon: "users" },
      { href: "/admin/warehouses", label: "Warehouses", icon: "warehouses" },
      { href: "/admin/taxonomy", label: "Taxonomy", icon: "catalog" },
    ];
  }
  return [];
}

export function getNavGroupsForRole(role: Role): NavGroup[] {
  const payables = payablesItemsFor(role);
  const groups: NavGroup[] = [
    ...(payables.length > 0
      ? [{ id: "payables" as const, label: "Payables", items: payables }]
      : []),
    { id: "insights", label: "Insights", items: insightItemsFor(role) },
    {
      id: "work",
      label: role === Role.FINANCE ? "Procurement" : "Procurement",
      items: workItemsFor(role),
    },
    { id: "governance", label: "Governance", items: governanceItemsFor(role) },
    { id: "admin", label: "Admin", items: adminItemsFor(role) },
  ];
  return groups.filter((group) => group.items.length > 0);
}

/** Flat list (preserved for callers that don't need grouping). */
export function getNavItemsForRole(role: Role): NavItem[] {
  return getNavGroupsForRole(role).flatMap((group) =>
    flattenNavItems(group.items),
  );
}

/**
 * Where each role lands after sign-in or when they hit `/`.
 */
export function defaultLandingFor(role: Role): string {
  switch (role) {
    case Role.SM:
    case Role.CENTRAL_TEAM:
    case Role.OPS_HEAD:
      return "/dashboard";
    case Role.FINANCE:
      return FINANCE_ROUTES.invoiceSettlement;
    case Role.ADMIN:
      return "/admin/platform";
  }
}

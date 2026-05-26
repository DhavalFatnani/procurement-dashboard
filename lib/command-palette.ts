import { Role } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  ClipboardList,
  FilePlus,
  FileText,
  Hash,
  LayoutDashboard,
  PackageCheck,
  Plus,
  Receipt,
  Upload,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";

import { getNavItemsForRole } from "@/lib/navigation";

export type CommandItem = {
  id: string;
  label: string;
  href?: string;
  action?: "add-vendor";
  icon: LucideIcon;
  shortcut?: string;
  roles?: Role[];
};

export type CommandGroup = {
  id: string;
  label: string;
  items: CommandItem[];
};

const NAV_COMMANDS: CommandItem[] = [
  { id: "nav-dashboard", label: "Go to Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { id: "nav-vendors", label: "Go to Vendors", href: "/vendors", icon: Building2 },
  {
    id: "nav-pr",
    label: "Go to Purchase Requests",
    href: "/purchase-requests",
    icon: FileText,
  },
  {
    id: "nav-po",
    label: "Go to Purchase Orders",
    href: "/purchase-orders",
    icon: ClipboardList,
  },
  {
    id: "nav-grn",
    label: "Go to Goods Receipt",
    href: "/goods-receipt",
    icon: PackageCheck,
  },
  { id: "nav-invoices", label: "Go to Invoices", href: "/invoices", icon: Receipt },
  { id: "nav-payments", label: "Go to Payments", href: "/payments", icon: Wallet },
  {
    id: "nav-serial",
    label: "Go to Serial Governance",
    href: "/serial-governance",
    icon: Hash,
  },
  { id: "nav-reports", label: "Go to Reports", href: "/reports", icon: BarChart3 },
  { id: "nav-admin-users", label: "Go to Users", href: "/admin/users", icon: Users },
  {
    id: "nav-admin-warehouses",
    label: "Go to Warehouses",
    href: "/admin/warehouses",
    icon: Warehouse,
  },
];

const ACTION_COMMANDS: CommandItem[] = [
  {
    id: "act-new-pr",
    label: "Create Purchase Request",
    href: "/purchase-requests/new",
    icon: FilePlus,
    roles: [Role.SM, Role.OPS_HEAD],
  },
  {
    id: "act-grn",
    label: "Record Goods Receipt",
    href: "/goods-receipt",
    icon: PackageCheck,
    roles: [Role.SM, Role.OPS_HEAD],
  },
  {
    id: "act-invoice",
    label: "Upload Invoice",
    href: "/invoices/new",
    icon: Upload,
    roles: [Role.SM, Role.OPS_HEAD],
  },
  {
    id: "act-vendor",
    label: "Add Vendor",
    href: "/vendors?addVendor=1",
    action: "add-vendor",
    icon: Plus,
    roles: [Role.OPS_HEAD],
  },
  {
    id: "act-add-user",
    label: "Add User",
    href: "/admin/users",
    icon: Users,
    roles: [Role.OPS_HEAD],
  },
  {
    id: "act-add-warehouse",
    label: "Add Warehouse",
    href: "/admin/warehouses",
    icon: Warehouse,
    roles: [Role.OPS_HEAD],
  },
];

function filterByRole(items: CommandItem[], role: Role) {
  return items.filter((item) => !item.roles || item.roles.includes(role));
}

function filterNavByRole(items: CommandItem[], role: Role) {
  const allowedHrefs = new Set(getNavItemsForRole(role).map((item) => item.href));
  return items.filter((item) => item.href != null && allowedHrefs.has(item.href));
}

export function getCommandGroups(role: Role): CommandGroup[] {
  return [
    { id: "navigation", label: "Navigation", items: filterNavByRole(NAV_COMMANDS, role) },
    { id: "actions", label: "Actions", items: filterByRole(ACTION_COMMANDS, role) },
  ];
}

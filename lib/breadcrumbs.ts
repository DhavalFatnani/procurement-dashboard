/** Serializable breadcrumb types — safe across Server/Client boundaries. */

export type BreadcrumbIconId =
  | "inbox"
  | "dashboard"
  | "purchaseRequests"
  | "purchaseOrders"
  | "goodsReceipt"
  | "invoices"
  | "payments"
  | "vendors"
  | "serialGovernance"
  | "reports";

export type BreadcrumbItem = {
  label: string;
  href?: string;
  mono?: boolean;
  icon?: BreadcrumbIconId;
};

import { Role } from "@/lib/prisma-enums";

/** Route-level guards aligned with KNOT_Procurement prompt 8.2 */
export const ACCESS = {
  dashboard: [Role.SM, Role.OPS_HEAD, Role.FINANCE, Role.ADMIN] as const,
  vendors: [Role.SM, Role.OPS_HEAD, Role.ADMIN] as const,
  purchaseRequests: [Role.SM, Role.OPS_HEAD, Role.ADMIN] as const,
  purchaseOrders: [Role.SM, Role.OPS_HEAD, Role.FINANCE, Role.ADMIN] as const,
  goodsReceipt: [Role.SM, Role.OPS_HEAD, Role.ADMIN] as const,
  invoices: [Role.SM, Role.OPS_HEAD, Role.FINANCE, Role.ADMIN] as const,
  payments: [Role.OPS_HEAD, Role.FINANCE, Role.ADMIN] as const,
  vendorAdvances: [Role.FINANCE, Role.ADMIN] as const,
  paymentRegister: [Role.FINANCE, Role.ADMIN] as const,
  inbox: [Role.SM, Role.OPS_HEAD, Role.FINANCE] as const,
  serialGovernance: [Role.SM, Role.OPS_HEAD, Role.ADMIN] as const,
  reports: [Role.SM, Role.OPS_HEAD, Role.FINANCE, Role.ADMIN] as const,
  profile: [Role.SM, Role.OPS_HEAD, Role.FINANCE, Role.ADMIN] as const,
  /** Master data: users, warehouses, catalog */
  admin: [Role.OPS_HEAD, Role.ADMIN] as const,
  /** Serial overrides, audit log, cross-warehouse repair tools */
  adminPlatform: [Role.ADMIN] as const,
} as const;

import { Role } from "@/lib/prisma-enums";

import { ADMIN_MASTER_DATA_ROLES, USER_ADMIN_ROLES } from "@/lib/admin-access";

const centralOpsRoutes = [
  Role.CENTRAL_TEAM,
  Role.OPS_HEAD,
  Role.ADMIN,
] as const;

/** Route-level guards aligned with KNOT_Procurement prompt 8.2 */
export const ACCESS = {
  dashboard: [Role.SM, Role.CENTRAL_TEAM, Role.OPS_HEAD, Role.FINANCE, Role.ADMIN] as const,
  vendors: [Role.SM, ...centralOpsRoutes] as const,
  purchaseRequests: [Role.SM, ...centralOpsRoutes] as const,
  purchaseOrders: [Role.SM, Role.CENTRAL_TEAM, Role.OPS_HEAD, Role.FINANCE, Role.ADMIN] as const,
  goodsReceipt: [Role.SM, ...centralOpsRoutes] as const,
  invoices: [Role.SM, Role.CENTRAL_TEAM, Role.OPS_HEAD, Role.FINANCE, Role.ADMIN] as const,
  payments: [Role.CENTRAL_TEAM, Role.OPS_HEAD, Role.FINANCE, Role.ADMIN] as const,
  vendorAdvances: [Role.FINANCE, Role.ADMIN] as const,
  paymentRegister: [Role.FINANCE, Role.ADMIN] as const,
  inbox: [Role.SM, Role.CENTRAL_TEAM, Role.OPS_HEAD, Role.FINANCE, Role.ADMIN] as const,
  serialGovernance: [Role.SM, ...centralOpsRoutes] as const,
  labelStudio: [Role.SM, ...centralOpsRoutes] as const,
  binLabelPrint: [Role.SM, ...centralOpsRoutes] as const,
  reports: [Role.SM, Role.CENTRAL_TEAM, Role.OPS_HEAD, Role.FINANCE, Role.ADMIN] as const,
  profile: [Role.SM, Role.CENTRAL_TEAM, Role.OPS_HEAD, Role.FINANCE, Role.ADMIN] as const,
  /** Master data: warehouses, taxonomy */
  admin: [...ADMIN_MASTER_DATA_ROLES],
  /** User provisioning */
  adminUsers: [...USER_ADMIN_ROLES],
  /** Serial overrides, audit log, cross-warehouse repair tools */
  adminPlatform: [Role.ADMIN] as const,
} as const;

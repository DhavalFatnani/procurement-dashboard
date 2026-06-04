import { Role } from "@/lib/prisma-enums";

/** Route-level guards aligned with KNOT_Procurement prompt 8.2 */
export const ACCESS = {
  dashboard: [Role.SM, Role.OPS_HEAD, Role.FINANCE] as const,
  vendors: [Role.SM, Role.OPS_HEAD] as const,
  purchaseRequests: [Role.SM, Role.OPS_HEAD] as const,
  purchaseOrders: [Role.SM, Role.OPS_HEAD, Role.FINANCE] as const,
  goodsReceipt: [Role.SM, Role.OPS_HEAD] as const,
  invoices: [Role.SM, Role.OPS_HEAD, Role.FINANCE] as const,
  payments: [Role.OPS_HEAD, Role.FINANCE] as const,
  vendorAdvances: [Role.FINANCE] as const,
  paymentRegister: [Role.FINANCE] as const,
  inbox: [Role.SM, Role.OPS_HEAD, Role.FINANCE] as const,
  serialGovernance: [Role.SM, Role.OPS_HEAD] as const,
  reports: [Role.SM, Role.OPS_HEAD, Role.FINANCE] as const,
  profile: [Role.SM, Role.OPS_HEAD, Role.FINANCE] as const,
  admin: [Role.OPS_HEAD] as const,
} as const;

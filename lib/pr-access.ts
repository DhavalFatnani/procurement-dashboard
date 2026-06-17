import { PRStatus, Role } from "@/lib/prisma-enums";

import type { SessionUser } from "@/lib/session";
import { userCanActForWarehouse } from "@/lib/warehouse-scope";

export type PurchaseRequestAccessFields = {
  status: PRStatus;
  warehouseId: string;
  createdById: string;
};

/** Whether the user may open a PR detail page. */
export function canViewPurchaseRequest(
  user: SessionUser,
  pr: PurchaseRequestAccessFields,
): boolean {
  if (user.role === Role.SM) {
    if (pr.createdById === user.id) {
      return userCanActForWarehouse(user, pr.warehouseId);
    }
    return (
      pr.status === PRStatus.REVISION_REQUIRED &&
      userCanActForWarehouse(user, pr.warehouseId)
    );
  }
  if (user.role === Role.OPS_HEAD || user.role === Role.CENTRAL_TEAM || user.role === Role.ADMIN) {
    return userCanActForWarehouse(user, pr.warehouseId);
  }
  return false;
}

/** Whether the user may edit line items on a PR in REVISION_REQUIRED. */
export function canRevisePurchaseRequest(
  user: SessionUser,
  pr: PurchaseRequestAccessFields,
): boolean {
  if (pr.status !== PRStatus.REVISION_REQUIRED) {
    return false;
  }
  if (user.role === Role.SM || user.role === Role.OPS_HEAD || user.role === Role.CENTRAL_TEAM || user.role === Role.ADMIN) {
    return userCanActForWarehouse(user, pr.warehouseId);
  }
  return false;
}

/** Whether SM may edit their own PR in DRAFT. */
export function canEditOwnDraftPurchaseRequest(
  user: SessionUser,
  pr: PurchaseRequestAccessFields,
): boolean {
  return (
    user.role === Role.SM &&
    pr.status === PRStatus.DRAFT &&
    pr.createdById === user.id &&
    userCanActForWarehouse(user, pr.warehouseId)
  );
}

/** Whether Ops Head may edit a PR in DRAFT within warehouse scope. */
export function canEditDraftPurchaseRequestAsOps(
  user: SessionUser,
  pr: PurchaseRequestAccessFields,
): boolean {
  return (
    (user.role === Role.OPS_HEAD ||
      user.role === Role.CENTRAL_TEAM ||
      user.role === Role.ADMIN) &&
    pr.status === PRStatus.DRAFT &&
    userCanActForWarehouse(user, pr.warehouseId)
  );
}

/** Whether the user may update PR line content (draft or revision). */
export function canUpdatePurchaseRequestLines(
  user: SessionUser,
  pr: PurchaseRequestAccessFields,
): boolean {
  if (canRevisePurchaseRequest(user, pr)) {
    return true;
  }
  if (canEditOwnDraftPurchaseRequest(user, pr)) {
    return true;
  }
  if (canEditDraftPurchaseRequestAsOps(user, pr)) {
    return true;
  }
  return false;
}

/** Whether PR detail should load category/catalog filter options for line editing. */
export function prDetailNeedsFilterOptions(
  role: SessionUser["role"],
  status: PRStatus,
): boolean {
  return (
    (role === Role.SM || role === Role.OPS_HEAD || role === Role.ADMIN) &&
    (status === PRStatus.DRAFT || status === PRStatus.REVISION_REQUIRED)
  );
}

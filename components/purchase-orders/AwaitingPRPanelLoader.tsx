import { Role } from "@/lib/prisma-enums";

import { ApprovedPRsAwaitingPO } from "@/components/purchase-orders/ApprovedPRsAwaitingPO";
import {
  getApprovedPRsAwaitingPO,
  getPOFilterOptions,
} from "@/lib/queries/purchase-orders";
import type { SessionUser } from "@/lib/session";
import { assignedWarehouseIds } from "@/lib/warehouse-scope";
import { timed } from "@/lib/server-timing";

export async function AwaitingPRPanelLoader({
  user,
  fulfillPrId,
}: {
  user: SessionUser;
  fulfillPrId?: string;
}) {
  const scopeWarehouseIds = assignedWarehouseIds(user);
  const [awaitingPRs, filterOptions] = await Promise.all([
    timed("PO.awaitingPRs", () =>
      getApprovedPRsAwaitingPO({ scopeWarehouseIds }),
    ),
    getPOFilterOptions(),
  ]);

  if (awaitingPRs.length === 0) {
    return null;
  }

  return (
    <ApprovedPRsAwaitingPO
      rows={awaitingPRs}
      activeVendors={filterOptions.vendors}
      fulfillPrId={fulfillPrId}
    />
  );
}

/** Server-only helper for page gating — Ops sees the Suspense boundary. */
export function showAwaitingPRPanel(role: Role): boolean {
  return role === Role.OPS_HEAD;
}

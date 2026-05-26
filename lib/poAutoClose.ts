import { prisma } from "@/lib/prisma";
import { sumLineValue } from "@/lib/purchase-lines";

/**
 * Default options for any `prisma.$transaction(...)` that calls
 * `applyPOClosureInTransaction`.
 *
 * The closure step issues a `findUnique` with deep includes (lines, GRNs +
 * exceptions, invoices + payments). On a remote Supabase pool that can take
 * several seconds — well past Prisma's 5s default transaction timeout — which
 * surfaces as a P2028 error and a knock-on P2024 pool starvation.
 */
export const PO_CLOSURE_TX_OPTS = {
  maxWait: 10_000,
  timeout: 20_000,
} as const;

export type { POClosureSnapshot } from "@/lib/po-closure-snapshot";
export {
  aggregateInvoiceMatchStatus,
  aggregatePaymentStatus,
  buildClosureSnapshot,
  deliveryStatusLabel,
  PO_WITH_RELATIONS,
  type POWithRelations,
} from "@/lib/po-closure-snapshot";

import {
  buildClosureSnapshot,
  PO_WITH_RELATIONS,
} from "@/lib/po-closure-snapshot";
import type { POClosureSnapshot } from "@/lib/po-closure-snapshot";

/** Recompute PO status from GRNs, invoices, and payments; persists when changed. */
export async function evaluatePOClosure(poId: string): Promise<POClosureSnapshot> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: PO_WITH_RELATIONS,
  });

  if (!po) {
    throw new Error(`Purchase order ${poId} not found`);
  }

  const snapshot = buildClosureSnapshot(po);

  if (po.status !== "FORCE_CLOSED" && snapshot.status !== po.status) {
    await prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: snapshot.status },
    });
  }

  return snapshot;
}

/** Same as evaluatePOClosure but inside an existing transaction (avoids a second round-trip). */
export async function applyPOClosureInTransaction(
  tx: Pick<typeof prisma, "purchaseOrder">,
  poId: string,
): Promise<void> {
  const po = await tx.purchaseOrder.findUnique({
    where: { id: poId },
    include: PO_WITH_RELATIONS,
  });

  if (!po) {
    throw new Error(`Purchase order ${poId} not found`);
  }

  const snapshot = buildClosureSnapshot(po);
  if (po.status !== "FORCE_CLOSED" && snapshot.status !== po.status) {
    await tx.purchaseOrder.update({
      where: { id: poId },
      data: { status: snapshot.status },
    });
  }
}

export { sumLineValue };

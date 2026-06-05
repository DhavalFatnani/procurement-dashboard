import type { Prisma } from "@/lib/prisma-client";
import { SerialReservationPurpose } from "@/lib/prisma-enums";

import { activeReservationsForSeriesWhere } from "@/lib/serial-series";
import type { SeriesCode } from "@/lib/series-codes";

export type AdminBlockScope =
  | { kind: "global" }
  | { kind: "warehouse"; warehouseId: string };

/**
 * Active reservations that conflict when placing an admin block.
 * Global blocks conflict with everything; warehouse blocks conflict with global
 * blocks, same-warehouse reservations, and any operational hold (globally unique).
 */
export function activeReservationsConflictingWithAdminBlock(
  series: SeriesCode,
  scope: AdminBlockScope,
): Prisma.SerialReservationWhereInput {
  const base = activeReservationsForSeriesWhere(series);
  if (scope.kind === "global") {
    return base;
  }

  return {
    ...base,
    OR: [
      { purpose: SerialReservationPurpose.ADMIN_BLOCK, warehouseId: null },
      { warehouseId: scope.warehouseId },
      { purpose: { not: SerialReservationPurpose.ADMIN_BLOCK } },
    ],
  };
}

/**
 * Active reservations that conflict when a warehouse allocates a serial range.
 */
export function activeReservationsConflictingWithWarehouseAllocation(
  series: SeriesCode,
  warehouseId: string,
): Prisma.SerialReservationWhereInput {
  return {
    ...activeReservationsForSeriesWhere(series),
    OR: [
      { purpose: { not: SerialReservationPurpose.ADMIN_BLOCK } },
      { purpose: SerialReservationPurpose.ADMIN_BLOCK, warehouseId: null },
      { purpose: SerialReservationPurpose.ADMIN_BLOCK, warehouseId },
    ],
  };
}

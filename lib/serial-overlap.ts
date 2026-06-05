import type { SerialReservation } from "@/lib/prisma-client";

import {
  type AdminBlockScope,
  activeReservationsConflictingWithAdminBlock,
  activeReservationsConflictingWithWarehouseAllocation,
} from "@/lib/serial-block-scope";
import { activeReservationsForSeriesWhere } from "@/lib/serial-series";
import type { SeriesCode } from "@/lib/series-codes";
import type { PrismaTx } from "@/lib/serialReservation";

export async function findOverlappingActiveReservation(
  tx: PrismaTx,
  input: {
    series: SeriesCode;
    rangeStart: bigint;
    rangeEnd: bigint;
    excludeId?: string;
    blockScope?: AdminBlockScope;
    warehouseId?: string;
  },
): Promise<SerialReservation | null> {
  const scopeWhere =
    input.blockScope != null
      ? activeReservationsConflictingWithAdminBlock(input.series, input.blockScope)
      : input.warehouseId != null
        ? activeReservationsConflictingWithWarehouseAllocation(
            input.series,
            input.warehouseId,
          )
        : activeReservationsForSeriesWhere(input.series);

  const candidates = await tx.serialReservation.findMany({
    where: {
      ...scopeWhere,
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      rangeStart: { lte: input.rangeEnd },
      rangeEnd: { gte: input.rangeStart },
    },
    take: 1,
  });
  return candidates[0] ?? null;
}

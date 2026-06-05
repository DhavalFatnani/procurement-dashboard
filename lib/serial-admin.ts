import {
  AdminAuditAction,
  POStatus,
  PRStatus,
  SerialReservationPurpose,
  SerialReservationStatus,
  type SerialReservation,
} from "@/lib/prisma-client";

import { writeAdminAuditLog } from "@/lib/admin-audit";
import { getCachedSeriesRegistry } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import type { AdminBlockScope } from "@/lib/serial-block-scope";
import { findOverlappingActiveReservation } from "@/lib/serial-overlap";
import {
  formatSerialNumberForSeries,
  getSeriesNumericBounds,
  GLOBAL_SERIAL_BLOCK_SCOPE_LABEL,
  isValidReservationRange,
  resolveSeriesCeiling,
} from "@/lib/serial-series";
import { resolveSeriesDisplayName } from "@/lib/series-config-resolve";
import type { SeriesCode } from "@/lib/series-codes";
import type { PrismaTx } from "@/lib/serialReservation";

export const ACTIVE_SERIAL_STATUSES: SerialReservationStatus[] = [
  SerialReservationStatus.PENDING,
  SerialReservationStatus.RESERVED,
];

export { findOverlappingActiveReservation } from "@/lib/serial-overlap";

export async function softReleaseReservation(
  tx: PrismaTx,
  input: {
    reservationId: string;
    actorId: string;
    reason: string;
    action?: AdminAuditAction;
    metadata?: Record<string, unknown>;
  },
): Promise<SerialReservation> {
  const reservation = await tx.serialReservation.findUnique({
    where: { id: input.reservationId },
  });
  if (!reservation) {
    throw new Error("Serial reservation not found.");
  }
  if (reservation.status === SerialReservationStatus.RELEASED) {
    return reservation;
  }

  const updated = await tx.serialReservation.update({
    where: { id: reservation.id },
    data: {
      status: SerialReservationStatus.RELEASED,
      releasedAt: new Date(),
      releasedById: input.actorId,
      releaseReason: input.reason.trim(),
      prId: null,
      poId: null,
    },
  });

  await writeAdminAuditLog(
    {
      actorId: input.actorId,
      action: input.action ?? AdminAuditAction.SERIAL_RELEASE,
      targetType: "SerialReservation",
      targetId: reservation.id,
      reason: input.reason,
      metadata: {
        series: reservation.series,
        rangeStart: reservation.rangeStart.toString(),
        rangeEnd: reservation.rangeEnd.toString(),
        previousStatus: reservation.status,
        ...input.metadata,
      },
    },
    tx,
  );

  return updated;
}

export async function adminBlockSerialRange(
  tx: PrismaTx,
  input: {
    actorId: string;
    series: SeriesCode;
    rangeStart: bigint;
    rangeEnd: bigint;
    /** null = global block across all warehouses */
    warehouseId: string | null;
    reason: string;
  },
): Promise<SerialReservation> {
  const trimmed = input.reason.trim();
  if (!trimmed) {
    throw new Error("Reason is required.");
  }
  const registry = await getCachedSeriesRegistry();
  if (!isValidReservationRange(input.series, input.rangeStart, input.rangeEnd, registry)) {
    throw new Error("Range is outside series bounds.");
  }

  const quantity = Number(input.rangeEnd - input.rangeStart + BigInt(1));
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error("Invalid range quantity.");
  }

  const config = await tx.seriesConfig.findUnique({ where: { code: input.series } });
  const ceiling = resolveSeriesCeiling(input.series, config?.ceilingNumber, registry);
  if (input.rangeEnd > ceiling) {
    throw new Error("Range ceiling exceeded.");
  }

  if (input.warehouseId) {
    const warehouse = await tx.warehouse.findUnique({
      where: { id: input.warehouseId },
      select: { id: true },
    });
    if (!warehouse) {
      throw new Error("Warehouse not found.");
    }
  }

  const blockScope: AdminBlockScope =
    input.warehouseId == null
      ? { kind: "global" }
      : { kind: "warehouse", warehouseId: input.warehouseId };

  const overlap = await findOverlappingActiveReservation(tx, {
    series: input.series,
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
    blockScope,
  });
  if (overlap) {
    throw new Error(
      `Range overlaps reservation ${overlap.id} (${formatSerialNumberForSeries(input.series, overlap.rangeStart)}–${formatSerialNumberForSeries(input.series, overlap.rangeEnd)}).`,
    );
  }

  const scopeKey = input.warehouseId ?? "global";
  const idempotencyKey = `admin-block-${input.series}-${scopeKey}-${input.rangeStart}-${input.rangeEnd}-${Date.now()}`;
  const reservation = await tx.serialReservation.create({
    data: {
      series: input.series,
      rangeStart: input.rangeStart,
      rangeEnd: input.rangeEnd,
      quantity,
      // Omit warehouseId for global blocks — Prisma rejects explicit `null` on XOR create inputs.
      ...(input.warehouseId != null ? { warehouseId: input.warehouseId } : {}),
      status: SerialReservationStatus.RESERVED,
      purpose: SerialReservationPurpose.ADMIN_BLOCK,
      idempotencyKey,
      createdById: input.actorId,
    },
  });

  await writeAdminAuditLog(
    {
      actorId: input.actorId,
      action: AdminAuditAction.SERIAL_BLOCK,
      targetType: "SerialReservation",
      targetId: reservation.id,
      reason: trimmed,
      metadata: {
        series: input.series,
        rangeStart: input.rangeStart.toString(),
        rangeEnd: input.rangeEnd.toString(),
        scope: input.warehouseId == null ? "global" : "warehouse",
        warehouseId: input.warehouseId,
      },
    },
    tx,
  );

  return reservation;
}

export async function adminSplitReservation(
  tx: PrismaTx,
  input: {
    actorId: string;
    reservationId: string;
    splitQuantity: number;
    reason: string;
  },
): Promise<{ kept: SerialReservation; split: SerialReservation }> {
  const trimmed = input.reason.trim();
  if (!trimmed) {
    throw new Error("Reason is required.");
  }
  if (input.splitQuantity <= 0) {
    throw new Error("Split quantity must be positive.");
  }

  const reservation = await tx.serialReservation.findUnique({
    where: { id: input.reservationId },
  });
  if (!reservation || reservation.status === SerialReservationStatus.RELEASED) {
    throw new Error("Active serial reservation not found.");
  }
  if (input.splitQuantity >= reservation.quantity) {
    throw new Error("Split quantity must be smaller than the reservation.");
  }

  const splitEnd = reservation.rangeStart + BigInt(input.splitQuantity) - BigInt(1);
  const remainingStart = splitEnd + BigInt(1);
  const remainingQty = reservation.quantity - input.splitQuantity;

  const splitReservation = await tx.serialReservation.create({
    data: {
      series: reservation.series,
      rangeStart: reservation.rangeStart,
      rangeEnd: splitEnd,
      quantity: input.splitQuantity,
      warehouseId: reservation.warehouseId,
      status: reservation.status,
      purpose: reservation.purpose,
      prId: reservation.prId,
      poId: reservation.poId,
      idempotencyKey: `${reservation.idempotencyKey}-split-${Date.now()}`,
      createdById: input.actorId,
    },
  });

  const kept = await tx.serialReservation.update({
    where: { id: reservation.id },
    data: {
      rangeStart: remainingStart,
      rangeEnd: reservation.rangeEnd,
      quantity: remainingQty,
      prId: null,
      poId: null,
    },
  });

  await writeAdminAuditLog(
    {
      actorId: input.actorId,
      action: AdminAuditAction.SERIAL_SPLIT,
      targetType: "SerialReservation",
      targetId: reservation.id,
      reason: trimmed,
      metadata: {
        splitReservationId: splitReservation.id,
        splitQuantity: input.splitQuantity,
      },
    },
    tx,
  );

  return { kept, split: splitReservation };
}

export async function adminReassignReservation(
  tx: PrismaTx,
  input: {
    actorId: string;
    reservationId: string;
    prId?: string | null;
    poId?: string | null;
    reason: string;
  },
): Promise<SerialReservation> {
  const trimmed = input.reason.trim();
  if (!trimmed) {
    throw new Error("Reason is required.");
  }

  const reservation = await tx.serialReservation.findUnique({
    where: { id: input.reservationId },
  });
  if (!reservation || reservation.status === SerialReservationStatus.RELEASED) {
    throw new Error("Active serial reservation not found.");
  }

  const updated = await tx.serialReservation.update({
    where: { id: reservation.id },
    data: {
      prId: input.prId ?? null,
      poId: input.poId ?? null,
    },
  });

  await writeAdminAuditLog(
    {
      actorId: input.actorId,
      action: AdminAuditAction.SERIAL_REASSIGN,
      targetType: "SerialReservation",
      targetId: reservation.id,
      reason: trimmed,
      metadata: {
        previousPrId: reservation.prId,
        previousPoId: reservation.poId,
        nextPrId: updated.prId,
        nextPoId: updated.poId,
      },
    },
    tx,
  );

  return updated;
}

/** Release all active serial reservations tied to a PR (cancel / force-close). */
export async function releaseSerialReservationsForPR(
  tx: PrismaTx,
  prId: string,
  actorId: string,
  reason: string,
): Promise<number> {
  const rows = await tx.serialReservation.findMany({
    where: {
      status: { in: ACTIVE_SERIAL_STATUSES },
      OR: [{ prId }, { idempotencyKey: { contains: prId } }],
    },
  });

  for (const row of rows) {
    await softReleaseReservation(tx, {
      reservationId: row.id,
      actorId,
      reason,
      action: AdminAuditAction.LIFECYCLE_RELEASE,
      metadata: { prId, trigger: "pr_lifecycle" },
    });
  }

  return rows.length;
}

/** Release active PO-linked serial reservations (cancel / force-close PO). */
export async function releaseSerialReservationsForPO(
  tx: PrismaTx,
  poId: string,
  actorId: string,
  reason: string,
): Promise<number> {
  const rows = await tx.serialReservation.findMany({
    where: {
      status: { in: ACTIVE_SERIAL_STATUSES },
      poId,
    },
  });

  for (const row of rows) {
    await softReleaseReservation(tx, {
      reservationId: row.id,
      actorId,
      reason,
      action: AdminAuditAction.LIFECYCLE_RELEASE,
      metadata: { poId, trigger: "po_lifecycle" },
    });
  }

  return rows.length;
}

export async function getSerialRepairQueue(limit = 25) {
  const registry = await getCachedSeriesRegistry();
  const rows = await prisma.serialReservation.findMany({
    where: {
      status: { in: ACTIVE_SERIAL_STATUSES },
      OR: [
        { purpose: SerialReservationPurpose.ADMIN_BLOCK },
        {
          AND: [
            { prId: { not: null } },
            { pr: { status: { in: [PRStatus.CANCELLED, PRStatus.FORCE_CANCELLED] } } },
          ],
        },
        {
          AND: [
            { poId: { not: null } },
            { po: { status: POStatus.FORCE_CLOSED } },
          ],
        },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      warehouse: { select: { name: true } },
      pr: { select: { id: true, status: true } },
      po: { select: { id: true, status: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    series: row.series,
    seriesName: resolveSeriesDisplayName(row.series, registry),
    rangeStart: formatSerialNumberForSeries(row.series, row.rangeStart),
    rangeEnd: formatSerialNumberForSeries(row.series, row.rangeEnd),
    quantity: row.quantity,
    status: row.status,
    purpose: row.purpose,
    warehouseName: row.warehouse?.name ?? GLOBAL_SERIAL_BLOCK_SCOPE_LABEL,
    prId: row.prId,
    prStatus: row.pr?.status ?? null,
    poId: row.poId,
    poStatus: row.po?.status ?? null,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function parseAdminSerialRange(
  series: SeriesCode,
  rangeStartRaw: string,
  rangeEndRaw: string,
): Promise<{ rangeStart: bigint; rangeEnd: bigint }> {
  const registry = await getCachedSeriesRegistry();
  const { start, end: seriesEnd } = getSeriesNumericBounds(series, registry);
  const rangeStart = BigInt(rangeStartRaw.replace(/\D/g, "") || "0");
  const rangeEnd = BigInt(rangeEndRaw.replace(/\D/g, "") || "0");
  if (rangeStart < start || rangeEnd > seriesEnd || rangeEnd < rangeStart) {
    throw new Error("Range is outside series bounds.");
  }
  return { rangeStart, rangeEnd };
}

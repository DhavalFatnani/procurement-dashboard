import { PRStatus, SerialReservationPurpose, type SerialReservation } from "@/lib/prisma-client";

import { findOverlappingActiveReservation } from "@/lib/serial-overlap";
import { registryForSeriesCode } from "@/lib/series-registry";
import {
  activeReservationsForSeriesWhere,
  computeNextRangeStart,
  formatSerialNumberForSeries,
  isValidReservationRange,
  resolveSeriesCeiling,
} from "@/lib/serial-series";
import { SERIES_CODES } from "@/lib/series-codes";
import type { PrismaTx } from "@/lib/serialReservation";

export const LOCK_TAGS_HOLD_IDEMPOTENCY = (prId: string) =>
  `pr-${prId}-lock-tags-hold`;

export const LOCK_TAGS_PO_IDEMPOTENCY = (poId: string) =>
  `po-${poId}-lock-tags`;

export function approvalHoldIdempotencyKey(prId: string): string {
  return LOCK_TAGS_HOLD_IDEMPOTENCY(prId);
}

export function poCommitIdempotencyKey(poId: string): string {
  return LOCK_TAGS_PO_IDEMPOTENCY(poId);
}

async function computeNextLockTagsRange(
  tx: PrismaTx,
  quantity: number,
): Promise<{ rangeStart: bigint; rangeEnd: bigint }> {
  const series = SERIES_CODES.LOCK_TAGS;
  const config = await tx.seriesConfig.findUnique({ where: { code: series } });
  const registry = registryForSeriesCode(series, config);

  const latest = await tx.serialReservation.findFirst({
    where: activeReservationsForSeriesWhere(series, registry),
    orderBy: { rangeEnd: "desc" },
  });

  const rangeStart = computeNextRangeStart(series, latest?.rangeEnd ?? null, registry);
  const rangeEnd = rangeStart + BigInt(quantity) - BigInt(1);

  const ceiling = resolveSeriesCeiling(series, config?.ceilingNumber, registry);
  if (rangeEnd > ceiling) {
    throw new Error("Range ceiling exceeded");
  }
  if (!isValidReservationRange(series, rangeStart, rangeEnd, registry)) {
    throw new Error("Reservation range outside series bounds");
  }

  return { rangeStart, rangeEnd };
}

/** Create or return existing PENDING approval hold for a vendor lock-tag PR. */
export async function createVendorLockTagsApprovalHold(
  tx: PrismaTx,
  input: {
    prId: string;
    quantity: number;
    warehouseId: string;
    createdById: string;
  },
): Promise<SerialReservation | null> {
  if (input.quantity <= 0) {
    return null;
  }

  const idempotencyKey = approvalHoldIdempotencyKey(input.prId);
  const existing = await tx.serialReservation.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    return existing;
  }

  const pr = await tx.purchaseRequest.findUnique({ where: { id: input.prId } });
  if (!pr || pr.status !== PRStatus.APPROVED) {
    throw new Error("Purchase request must be approved to hold lock tag serials.");
  }

  const { rangeStart, rangeEnd } = await computeNextLockTagsRange(tx, input.quantity);

  const overlap = await findOverlappingActiveReservation(tx, {
    series: SERIES_CODES.LOCK_TAGS,
    rangeStart,
    rangeEnd,
    warehouseId: input.warehouseId,
  });
  if (overlap) {
    throw new Error(
      `Range overlaps reservation ${overlap.id} (${formatSerialNumberForSeries(SERIES_CODES.LOCK_TAGS, overlap.rangeStart)}–${formatSerialNumberForSeries(SERIES_CODES.LOCK_TAGS, overlap.rangeEnd)}).`,
    );
  }

  return tx.serialReservation.create({
    data: {
      series: SERIES_CODES.LOCK_TAGS,
      rangeStart,
      rangeEnd,
      quantity: input.quantity,
      warehouseId: input.warehouseId,
      status: "PENDING",
      purpose: SerialReservationPurpose.VENDOR_LOCK_TAGS,
      prId: input.prId,
      idempotencyKey,
      createdById: input.createdById,
    },
  });
}

/** Delete PENDING approval hold for a PR (revert approval, etc.). */
export async function releaseVendorLockTagsApprovalHold(
  tx: PrismaTx,
  prId: string,
): Promise<void> {
  await tx.serialReservation.deleteMany({
    where: { prId, status: "PENDING", poId: null },
  });
}

/** Delete RESERVED serial block for a PO (cancel PO before GRN). */
export async function releaseVendorLockTagsPoReservation(
  tx: PrismaTx,
  poId: string,
): Promise<void> {
  await tx.serialReservation.deleteMany({
    where: { poId, series: SERIES_CODES.LOCK_TAGS },
  });
}

/**
 * Commit lock-tag serials from PR approval hold onto a PO.
 * Splits the hold when the PO carries fewer tags than the full PR hold.
 */
export async function commitVendorLockTagsHoldToPo(
  tx: PrismaTx,
  input: {
    prId: string;
    poId: string;
    quantity: number;
    warehouseId: string;
    createdById: string;
  },
): Promise<SerialReservation | null> {
  if (input.quantity <= 0) {
    return null;
  }

  const existingPo = await tx.serialReservation.findUnique({
    where: { idempotencyKey: poCommitIdempotencyKey(input.poId) },
  });
  if (existingPo) {
    return existingPo;
  }

  const hold = await tx.serialReservation.findFirst({
    where: { prId: input.prId, status: "PENDING", poId: null },
  });

  if (!hold) {
    throw new Error(
      "No lock tag serial hold found on this purchase request. Re-approve the PR or contact support.",
    );
  }

  if (input.quantity > hold.quantity) {
    throw new Error(
      `PO lock tag quantity (${input.quantity}) exceeds the PR hold (${hold.quantity}).`,
    );
  }

  if (input.quantity === hold.quantity) {
    return tx.serialReservation.update({
      where: { id: hold.id },
      data: {
        status: "RESERVED",
        prId: null,
        poId: input.poId,
        idempotencyKey: poCommitIdempotencyKey(input.poId),
      },
    });
  }

  const poRangeEnd = hold.rangeStart + BigInt(input.quantity) - BigInt(1);
  const remainingStart = poRangeEnd + BigInt(1);
  const remainingQty = hold.quantity - input.quantity;

  const poReservation = await tx.serialReservation.create({
    data: {
      series: SERIES_CODES.LOCK_TAGS,
      rangeStart: hold.rangeStart,
      rangeEnd: poRangeEnd,
      quantity: input.quantity,
      warehouseId: input.warehouseId,
      status: "RESERVED",
      purpose: SerialReservationPurpose.VENDOR_LOCK_TAGS,
      poId: input.poId,
      idempotencyKey: poCommitIdempotencyKey(input.poId),
      createdById: input.createdById,
    },
  });

  await tx.serialReservation.update({
    where: { id: hold.id },
    data: {
      rangeStart: remainingStart,
      rangeEnd: hold.rangeEnd,
      quantity: remainingQty,
    },
  });

  return poReservation;
}

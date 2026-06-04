import {
  ExecutionType,
  PRStatus,
  Prisma,
  SerialSeries,
  type SerialReservation,
} from "@/lib/prisma-client";

import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  computeNextRangeStart,
  getSeriesNumericBounds,
  getSeriesStartNumber,
  isValidReservationRange,
  resolveSeriesCeiling,
} from "@/lib/serial-series";
import { assertPRStatusTransition } from "@/lib/prStatus";

/** PR row to create in the same transaction as the serial reservation (internal print). */
export type InternalPrintPRPayload = {
  categoryId: string;
  subcategoryId: string;
  quantity: number;
  warehouseId: string;
  executionType: ExecutionType;
  createdById: string;
};

export type ReserveSerialPurpose = "internal_print" | "vendor_lock_tags";

export type ReserveSerialInput = {
  series: SerialSeries;
  quantity: number;
  warehouseId: string;
  createdById: string;
  prId: string;
  idempotencyKey: string;
  /** Defaults to internal_print for backward compatibility. */
  purpose?: ReserveSerialPurpose;
  /** Required when purpose is vendor_lock_tags. */
  poId?: string;
  /** When set, creates the PR inside the reservation transaction if it does not exist yet. */
  internalPrintPR?: InternalPrintPRPayload;
};

export type ReserveSerialResult =
  | { success: true; reservation: SerialReservation }
  | { success: false; error: string };

export type PrismaTx = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends" | "$use"
>;

export { getSeriesStartNumber } from "@/lib/serial-series";

const VENDOR_LOCK_TAGS_ALLOWED_PR_STATUSES: readonly PRStatus[] = [
  PRStatus.APPROVED,
  PRStatus.CONVERTED_TO_PO,
];

function assertVendorLockTagsPrStatus(status: PRStatus): void {
  if (!VENDOR_LOCK_TAGS_ALLOWED_PR_STATUSES.includes(status)) {
    throw new Error(
      `Purchase request must be approved before reserving vendor lock tag serials (status: ${status}).`,
    );
  }
}

async function computeReservationRange(
  tx: PrismaTx,
  series: SerialSeries,
  quantity: number,
): Promise<{ rangeStart: bigint; rangeEnd: bigint }> {
  const { start: seriesStart } = getSeriesNumericBounds(series);

  const latest = await tx.serialReservation.findFirst({
    where: {
      series,
      rangeStart: { gte: seriesStart },
      rangeEnd: { gte: seriesStart },
    },
    orderBy: { rangeEnd: "desc" },
  });

  const rangeStart = computeNextRangeStart(series, latest?.rangeEnd ?? null);
  const rangeEnd = rangeStart + BigInt(quantity) - BigInt(1);

  const config = await tx.seriesConfig.findUnique({
    where: { series },
  });
  const ceiling = resolveSeriesCeiling(series, config?.ceilingNumber);
  if (rangeEnd > ceiling) {
    throw new Error("Range ceiling exceeded");
  }

  if (!isValidReservationRange(series, rangeStart, rangeEnd)) {
    throw new Error("Reservation range outside series bounds");
  }

  return { rangeStart, rangeEnd };
}

/**
 * Reserve a serial range inside an existing transaction (e.g. PO creation).
 * Throws on failure — caller should roll back the outer transaction.
 */
export async function reserveSerialRangeInTransaction(
  tx: PrismaTx,
  input: ReserveSerialInput,
): Promise<SerialReservation> {
  const purpose = input.purpose ?? "internal_print";

  const existing = await tx.serialReservation.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) {
    return existing;
  }

  if (purpose === "vendor_lock_tags") {
    if (!input.poId) {
      throw new Error("poId is required for vendor lock tag serial reservations.");
    }
  }

  const { rangeStart, rangeEnd } = await computeReservationRange(
    tx,
    input.series,
    input.quantity,
  );

  if (input.internalPrintPR) {
    const existingPr = await tx.purchaseRequest.findUnique({
      where: { id: input.prId },
    });
    if (!existingPr) {
      const prData = input.internalPrintPR;
      await tx.purchaseRequest.create({
        data: {
          id: input.prId,
          categoryId: prData.categoryId,
          subcategoryId: prData.subcategoryId,
          quantity: prData.quantity,
          warehouseId: prData.warehouseId,
          executionType: prData.executionType,
          status: PRStatus.DRAFT,
          createdById: prData.createdById,
          lines: {
            create: {
              lineNumber: 1,
              categoryId: prData.categoryId,
              subcategoryId: prData.subcategoryId,
              quantity: prData.quantity,
            },
          },
        },
      });
    }
  }

  const pr = await tx.purchaseRequest.findUnique({ where: { id: input.prId } });
  if (!pr) {
    throw new Error("Purchase request not found");
  }

  if (purpose === "internal_print") {
    assertPRStatusTransition(pr.status, PRStatus.EXECUTED_PRINT);
  } else {
    assertVendorLockTagsPrStatus(pr.status);
  }

  const reservation = await tx.serialReservation.create({
    data: {
      series: input.series,
      rangeStart,
      rangeEnd,
      quantity: input.quantity,
      warehouseId: input.warehouseId,
      status: "RESERVED",
      prId: purpose === "vendor_lock_tags" ? null : input.prId,
      poId: purpose === "vendor_lock_tags" ? input.poId : undefined,
      idempotencyKey: input.idempotencyKey,
      createdById: input.createdById,
    },
  });

  if (purpose === "internal_print") {
    await tx.purchaseRequest.update({
      where: { id: input.prId },
      data: { status: PRStatus.EXECUTED_PRINT },
    });
  }

  return reservation;
}

async function reserveInTransaction(
  input: ReserveSerialInput,
): Promise<SerialReservation> {
  return prisma.$transaction(
    async (tx) => reserveSerialRangeInTransaction(tx, input),
    SERIAL_RESERVE_TX_OPTS,
  );
}

const CEILING_ERROR =
  "Serial range ceiling reached for this series. Contact Ops Head to update the ceiling.";
const TIMEOUT_ERROR =
  "Reservation took too long. Please try again.";

/** Remote Supabase + Serializable isolation can exceed Prisma's 5s default. */
export const SERIAL_RESERVE_TX_OPTS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 20_000,
} as const;

/** Backoff before each retry of a serialization conflict (ms). */
const RETRY_DELAYS_MS = [100, 200, 400];

function isCeilingError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("ceiling");
}

/**
 * Transient failures worth retrying: serialization conflicts (P2034) and
 * interactive transaction timeouts (P2028) on remote poolers.
 */
function isTransactionRetryableError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return err.code === "P2034" || err.code === "P2028";
  }
  if (!(err instanceof Error)) {
    return false;
  }
  return (
    err.message.includes("could not serialize") ||
    err.message.includes("Serialization failure") ||
    err.message.includes("P2034") ||
    err.message.includes("P2028") ||
    err.message.includes("Transaction not found")
  );
}

export async function atomicReserveSerialRange(
  input: ReserveSerialInput,
): Promise<ReserveSerialResult> {
  const existing = await prisma.serialReservation.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) {
    return { success: true, reservation: existing };
  }

  // Retry transient serialization conflicts with bounded exponential backoff.
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]!));
    }
    try {
      const reservation = await reserveInTransaction(input);
      return { success: true, reservation };
    } catch (err) {
      if (isCeilingError(err)) {
        return { success: false, error: CEILING_ERROR };
      }
      if (!isTransactionRetryableError(err)) {
        logger.error(
          { err, series: input.series, prId: input.prId },
          "serial reservation failed",
        );
        return {
          success: false,
          error: err instanceof Error ? err.message : "Reservation failed",
        };
      }
      // Transient conflict/timeout: fall through to the next attempt.
    }
  }

  logger.warn(
    { series: input.series, prId: input.prId, attempts: RETRY_DELAYS_MS.length + 1 },
    "serial reservation exhausted retries on transient transaction error",
  );
  return { success: false, error: TIMEOUT_ERROR };
}

import { Prisma, SerialSeries, type SerialReservation } from "@prisma/client";

import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  computeNextRangeStart,
  getSeriesNumericBounds,
  getSeriesStartNumber,
  isValidReservationRange,
  resolveSeriesCeiling,
} from "@/lib/serial-series";

export type ReserveSerialInput = {
  series: SerialSeries;
  quantity: number;
  warehouseId: string;
  createdById: string;
  prId: string;
  idempotencyKey: string;
};

export type ReserveSerialResult =
  | { success: true; reservation: SerialReservation }
  | { success: false; error: string };

export { getSeriesStartNumber } from "@/lib/serial-series";

async function reserveInTransaction(
  input: ReserveSerialInput,
): Promise<SerialReservation> {
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.serialReservation.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        return existing;
      }

      const { start: seriesStart } = getSeriesNumericBounds(input.series);

      const latest = await tx.serialReservation.findFirst({
        where: {
          series: input.series,
          rangeStart: { gte: seriesStart },
          rangeEnd: { gte: seriesStart },
        },
        orderBy: { rangeEnd: "desc" },
      });

      const rangeStart = computeNextRangeStart(input.series, latest?.rangeEnd ?? null);
      const rangeEnd = rangeStart + BigInt(input.quantity) - BigInt(1);

      const config = await tx.seriesConfig.findUnique({
        where: { series: input.series },
      });
      const ceiling = resolveSeriesCeiling(
        input.series,
        config?.ceilingNumber,
      );
      if (rangeEnd > ceiling) {
        throw new Error("Range ceiling exceeded");
      }

      if (!isValidReservationRange(input.series, rangeStart, rangeEnd)) {
        throw new Error("Reservation range outside series bounds");
      }

      return tx.serialReservation.create({
        data: {
          series: input.series,
          rangeStart,
          rangeEnd,
          quantity: input.quantity,
          warehouseId: input.warehouseId,
          status: "RESERVED",
          prId: input.prId,
          idempotencyKey: input.idempotencyKey,
          createdById: input.createdById,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

const CEILING_ERROR =
  "Serial range ceiling reached for this series. Contact Ops Head to update the ceiling.";
const CONFLICT_ERROR =
  "Another print request was being processed. Please try again.";

/** Backoff before each retry of a serialization conflict (ms). */
const RETRY_DELAYS_MS = [100, 200, 400];

function isCeilingError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("ceiling");
}

/**
 * A Postgres serialization failure under SERIALIZABLE isolation. Prisma surfaces
 * this as the typed error code P2034; we keep the message-string checks as a
 * fallback for environments that don't produce the typed error.
 */
function isSerializationConflict(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return err.code === "P2034";
  }
  if (!(err instanceof Error)) {
    return false;
  }
  return (
    err.message.includes("could not serialize") ||
    err.message.includes("Serialization failure") ||
    err.message.includes("P2034")
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
      if (!isSerializationConflict(err)) {
        logger.error(
          { err, series: input.series, prId: input.prId },
          "serial reservation failed",
        );
        return {
          success: false,
          error: err instanceof Error ? err.message : "Reservation failed",
        };
      }
      // Serialization conflict: fall through to the next attempt.
    }
  }

  logger.warn(
    { series: input.series, prId: input.prId, attempts: RETRY_DELAYS_MS.length + 1 },
    "serial reservation exhausted retries on serialization conflict",
  );
  return { success: false, error: CONFLICT_ERROR };
}

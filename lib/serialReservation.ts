import { Prisma, SerialSeries, type SerialReservation } from "@prisma/client";

import { prisma } from "@/lib/prisma";

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

function getSeriesStartNumber(series: SerialSeries): bigint {
  switch (series) {
    case SerialSeries.LOCK_TAGS:
      return BigInt(100_000);
    case SerialSeries.JEWELLERY_BARCODES:
      return BigInt(1_000_000_000);
    case SerialSeries.APPAREL_BARCODES:
      return BigInt(2_000_000_000);
  }
}

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

      const latest = await tx.serialReservation.findFirst({
        where: { series: input.series },
        orderBy: { rangeEnd: "desc" },
      });

      const rangeStart = latest
        ? latest.rangeEnd + BigInt(1)
        : getSeriesStartNumber(input.series);
      const rangeEnd = rangeStart + BigInt(input.quantity) - BigInt(1);

      const config = await tx.seriesConfig.findUnique({
        where: { series: input.series },
      });
      if (config && rangeEnd > config.ceilingNumber) {
        throw new Error("Range ceiling exceeded");
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

export async function atomicReserveSerialRange(
  input: ReserveSerialInput,
): Promise<ReserveSerialResult> {
  const existing = await prisma.serialReservation.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) {
    return { success: true, reservation: existing };
  }

  try {
    const reservation = await reserveInTransaction(input);
    return { success: true, reservation };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reservation failed";
    if (message.includes("ceiling")) {
      return {
        success: false,
        error:
          "Serial range ceiling reached for this series. Contact Ops Head to update the ceiling.",
      };
    }
    if (
      message.includes("could not serialize") ||
      message.includes("Serialization failure") ||
      message.includes("P2034")
    ) {
      await new Promise((r) => setTimeout(r, 200));
      try {
        const reservation = await reserveInTransaction(input);
        return { success: true, reservation };
      } catch (retryErr) {
        const retryMsg = retryErr instanceof Error ? retryErr.message : message;
        if (retryMsg.includes("ceiling")) {
          return {
            success: false,
            error:
              "Serial range ceiling reached for this series. Contact Ops Head to update the ceiling.",
          };
        }
        return {
          success: false,
          error: "Another print request was being processed. Please try again.",
        };
      }
    }
    return { success: false, error: message };
  }
}

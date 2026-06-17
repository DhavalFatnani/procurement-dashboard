import "server-only";

import { ExecutionType } from "@/lib/prisma-enums";

import { getCachedSeriesRegistry } from "@/lib/cache";
import { canViewPurchaseRequest } from "@/lib/pr-access";
import { lockTagsQtyFromSelectedItems } from "@/lib/purchase-lines";
import { prisma } from "@/lib/prisma";
import { resolveSeriesDisplayName } from "@/lib/series-config-resolve";
import {
  computeNextRangeStart,
  formatSerialNumberForSeries,
  validReservationsForSeriesWhere,
} from "@/lib/serial-series";
import { SERIES_CODES, type SeriesCode } from "@/lib/series-codes";
import type { LockTagsSerialPreview } from "@/lib/serial-governance-types";
import type { SessionUser } from "@/lib/session";

async function seriesDisplayName(code: SeriesCode): Promise<string> {
  const registry = await getCachedSeriesRegistry();
  return resolveSeriesDisplayName(code, registry);
}

export async function buildLockTagsRangePreview(
  quantity: number,
): Promise<LockTagsSerialPreview | null> {
  if (quantity <= 0) {
    return null;
  }

  const series = SERIES_CODES.LOCK_TAGS;
  const latest = await prisma.serialReservation.findFirst({
    where: validReservationsForSeriesWhere(series),
    orderBy: { rangeEnd: "desc" },
  });

  const lastEnd = latest?.rangeEnd ?? null;
  const nextStart = computeNextRangeStart(series, lastEnd);
  const rangeEnd = nextStart + BigInt(quantity) - BigInt(1);

  return {
    series,
    seriesName: await seriesDisplayName(series),
    quantity,
    rangeStart: formatSerialNumberForSeries(series, nextStart),
    rangeEnd: formatSerialNumberForSeries(series, rangeEnd),
    lastRangeEnd:
      lastEnd != null ? formatSerialNumberForSeries(series, lastEnd) : null,
    previewOnly: true,
    isHeld: false,
  };
}

const prPreviewSelect = {
  executionType: true,
  status: true,
  warehouseId: true,
  createdById: true,
  lines: {
    select: {
      category: { select: { name: true } },
      items: { select: { id: true, quantity: true } },
    },
  },
} as const;

/** Read-only lock-tag preview for PR detail — returns null when access is denied. */
export async function getLockTagsSerialPreviewForPRQuery(
  user: SessionUser,
  prId: string,
): Promise<LockTagsSerialPreview | null> {
  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    select: prPreviewSelect,
  });

  if (!pr || pr.executionType !== ExecutionType.VENDOR_PURCHASE) {
    return null;
  }

  if (
    !canViewPurchaseRequest(user, {
      status: pr.status,
      warehouseId: pr.warehouseId,
      createdById: pr.createdById,
    })
  ) {
    return null;
  }

  const allItemIds = new Set(
    pr.lines.flatMap((line) => line.items.map((item) => item.id)),
  );
  const quantity = lockTagsQtyFromSelectedItems(
    pr.lines.map((line) => ({
      categoryName: line.category.name,
      items: line.items,
    })),
    allItemIds,
  );

  if (quantity <= 0) {
    return null;
  }

  const hold = await prisma.serialReservation.findFirst({
    where: { prId, status: "PENDING", poId: null, series: SERIES_CODES.LOCK_TAGS },
  });

  if (hold) {
    return {
      series: SERIES_CODES.LOCK_TAGS,
      seriesName: await seriesDisplayName(SERIES_CODES.LOCK_TAGS),
      quantity: hold.quantity,
      rangeStart: formatSerialNumberForSeries(SERIES_CODES.LOCK_TAGS, hold.rangeStart),
      rangeEnd: formatSerialNumberForSeries(SERIES_CODES.LOCK_TAGS, hold.rangeEnd),
      lastRangeEnd: null,
      previewOnly: true,
      isHeld: true,
    };
  }

  return buildLockTagsRangePreview(quantity);
}

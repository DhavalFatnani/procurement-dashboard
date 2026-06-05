"use server";

import { ExecutionType, PRStatus, Role } from "@/lib/prisma-enums";
import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";

import type { MutationResult } from "@/lib/action-result";
import { getCachedSeriesRegistry } from "@/lib/cache";
import { formatWarehouseLabel } from "@/lib/format-warehouse";
import { revalidateInternalPrintMutation, revalidateSerialGovernance } from "@/lib/revalidate-tags";

import { newPurchaseRequestId } from "@/lib/ids";
import { prisma } from "@/lib/prisma";
import {
  getSerialActivity as getSerialActivityQuery,
  getSerialGovernanceFilterOptions as getSerialGovernanceFilterOptionsQuery,
  getSeriesConfigsForAdvanced as getSeriesConfigsForAdvancedQuery,
  getWarehouseSeriesSnapshot as getWarehouseSeriesSnapshotQuery,
  searchSerialNumber as searchSerialNumberQuery,
  type SerialActivityFilters,
} from "@/lib/queries/serial";
import { LIST_CACHE_TAGS } from "@/lib/list-cache";
import { assertPRStatusTransition } from "@/lib/prStatus";
import { resolveSeriesDisplayName } from "@/lib/series-config-resolve";
import {
  computeNextRangeStart,
  formatSerialNumberForSeries,
  getSeriesPrefix,
  getSeriesStartNumber,
  resolveSeriesCeiling,
  validateInternalPrintQuantity,
  validReservationsForSeriesWhere,
} from "@/lib/serial-series";
import { SERIES_CODES, type SeriesCode } from "@/lib/series-codes";
import {
  atomicReserveSerialRange,
  type InternalPrintPRPayload,
} from "@/lib/serialReservation";
import { requireRoles } from "@/lib/server-action-guard";
import { ALL_DASHBOARD_ROLES, FINANCE_OR_ADMIN_ROLES, OPS_FINANCE_OR_ADMIN_ROLES, OPS_OR_ADMIN_ROLES, SM_OPS_OR_ADMIN_ROLES } from "@/lib/admin-access";
import { assertUserWarehouseAccess } from "@/lib/warehouse-access";
import { lockTagsQtyFromSelectedItems } from "@/lib/purchase-lines";

const WAREHOUSE_SCOPE_ERROR = "You cannot reserve serials for this warehouse.";

async function seriesDisplayName(code: SeriesCode): Promise<string> {
  const registry = await getCachedSeriesRegistry();
  return resolveSeriesDisplayName(code, registry);
}

export type LockTagsSerialPreview = {
  series: SeriesCode;
  seriesName: string;
  quantity: number;
  rangeStart: string;
  rangeEnd: string;
  lastRangeEnd: string | null;
  previewOnly: true;
  /** True when range is already blocked on PR approval (PENDING hold). */
  isHeld: boolean;
};

async function buildLockTagsRangePreview(quantity: number): Promise<LockTagsSerialPreview | null> {
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

/** Live preview of the next lock-tag range for a quantity (no ledger write). */
export async function getLockTagsSerialPreviewForQuantity(
  quantity: number,
): Promise<LockTagsSerialPreview | null> {
  await requireRoles([...SM_OPS_OR_ADMIN_ROLES]);
  return buildLockTagsRangePreview(quantity);
}

/** Preview lock-tag serial range for an approved vendor PR (held or estimated). */
export async function getLockTagsSerialPreviewForPR(
  prId: string,
): Promise<LockTagsSerialPreview | null> {
  await requireRoles([...SM_OPS_OR_ADMIN_ROLES]);

  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    select: {
      executionType: true,
      lines: {
        select: {
          category: { select: { name: true } },
          items: { select: { id: true, quantity: true } },
        },
      },
    },
  });

  if (!pr || pr.executionType !== ExecutionType.VENDOR_PURCHASE) {
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

/** Preview lock-tag range for selected PR line items (PO create form). */
export async function getLockTagsSerialPreviewForPRItems(
  prId: string,
  prLineItemIds: string[],
): Promise<LockTagsSerialPreview | null> {
  await requireRoles([...OPS_OR_ADMIN_ROLES]);

  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    select: {
      executionType: true,
      lines: {
        select: {
          category: { select: { name: true } },
          items: { select: { id: true, quantity: true } },
        },
      },
    },
  });

  if (!pr || pr.executionType !== ExecutionType.VENDOR_PURCHASE) {
    return null;
  }

  const selectedIds = new Set(prLineItemIds);
  const quantity = lockTagsQtyFromSelectedItems(
    pr.lines.map((line) => ({
      categoryName: line.category.name,
      items: line.items,
    })),
    selectedIds,
  );

  if (quantity <= 0) {
    return null;
  }

  const hold = await prisma.serialReservation.findFirst({
    where: { prId, status: "PENDING", poId: null, series: SERIES_CODES.LOCK_TAGS },
  });

  if (hold) {
    if (quantity > hold.quantity) {
      return null;
    }
    const rangeEnd = hold.rangeStart + BigInt(quantity) - BigInt(1);
    return {
      series: SERIES_CODES.LOCK_TAGS,
      seriesName: await seriesDisplayName(SERIES_CODES.LOCK_TAGS),
      quantity,
      rangeStart: formatSerialNumberForSeries(SERIES_CODES.LOCK_TAGS, hold.rangeStart),
      rangeEnd: formatSerialNumberForSeries(SERIES_CODES.LOCK_TAGS, rangeEnd),
      lastRangeEnd: null,
      previewOnly: true,
      isHeld: true,
    };
  }

  return buildLockTagsRangePreview(quantity);
}

export async function getSerialSeriesHint(subcategoryId: string) {
  await requireRoles([...SM_OPS_OR_ADMIN_ROLES]);
  const sub = await prisma.subcategory.findUnique({
    where: { id: subcategoryId },
    include: { category: { select: { name: true } } },
  });
  if (!sub?.series) {
    return null;
  }

  const latest = await prisma.serialReservation.findFirst({
    where: validReservationsForSeriesWhere(sub.series),
    orderBy: { rangeEnd: "desc" },
  });

  const lastEnd = latest?.rangeEnd ?? null;
  const nextStart = computeNextRangeStart(sub.series, lastEnd);

  return {
    categoryName: sub.category.name,
    series: sub.series,
    seriesName: await seriesDisplayName(sub.series),
    executionType: sub.executionType,
    lastRangeEnd: lastEnd != null ? formatSerialNumberForSeries(sub.series, lastEnd) : null,
    nextStart: formatSerialNumberForSeries(sub.series, nextStart),
  };
}

/** Reserve serial range for a PR print execution (Prompt 5.1). */
export async function reserveSerialRange(input: {
  prId?: string;
  categoryId: string;
  subcategoryId: string;
  quantity: number;
  warehouseId: string;
  idempotencyKey: string;
}): Promise<{ ok: boolean; prId?: string; reservationId?: string; error?: string }> {
  return reserveSerialRangeForPR(input);
}

export async function reserveSerialRangeForPR(input: {
  prId?: string;
  categoryId: string;
  subcategoryId: string;
  quantity: number;
  warehouseId: string;
  idempotencyKey: string;
}): Promise<{ ok: boolean; prId?: string; reservationId?: string; error?: string }> {
  const user = await requireRoles([...SM_OPS_OR_ADMIN_ROLES]);

  const access = await assertUserWarehouseAccess(user.id, input.warehouseId);
  if (!access.ok) {
    return { ok: false, error: access.message ?? WAREHOUSE_SCOPE_ERROR };
  }

  const sub = await prisma.subcategory.findUnique({ where: { id: input.subcategoryId } });
  if (!sub?.series) {
    return { ok: false, error: "Subcategory has no serial series." };
  }

  const quantityError = validateInternalPrintQuantity(
    input.quantity,
    sub.executionType,
  );
  if (quantityError) {
    return { ok: false, error: quantityError };
  }

  const existingReservation = await prisma.serialReservation.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existingReservation?.prId) {
    revalidateInternalPrintMutation(existingReservation.prId);
    after(() => {
      revalidatePath("/purchase-requests");
      revalidateSerialGovernance();
      revalidatePath("/dashboard");
      revalidateTag("dashboard-metrics");
      revalidateTag(LIST_CACHE_TAGS.inbox);
    });
    return {
      ok: true,
      prId: existingReservation.prId,
      reservationId: existingReservation.id,
    };
  }

  let prId = input.prId;
  let internalPrintPR: InternalPrintPRPayload | undefined;

  if (!prId) {
    prId = newPurchaseRequestId();
    internalPrintPR = {
      categoryId: input.categoryId,
      subcategoryId: input.subcategoryId,
      quantity: input.quantity,
      warehouseId: input.warehouseId,
      executionType: sub.executionType,
      createdById: user.id,
    };
  } else {
    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: prId },
      include: { serialReservation: { select: { id: true } } },
    });
    if (!pr) {
      return { ok: false, error: "Purchase request not found." };
    }
    if (pr.serialReservation) {
      return {
        ok: true,
        prId,
        reservationId: pr.serialReservation.id,
      };
    }
    try {
      assertPRStatusTransition(pr.status, PRStatus.EXECUTED_PRINT);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Invalid status." };
    }
  }

  const result = await atomicReserveSerialRange({
    series: sub.series,
    quantity: input.quantity,
    warehouseId: input.warehouseId,
    createdById: user.id,
    prId,
    idempotencyKey: input.idempotencyKey,
    purpose: "internal_print",
    internalPrintPR,
  });

  if (!result.success) {
    return { ok: false, error: result.error };
  }

  revalidateInternalPrintMutation(prId);

  after(() => {
    revalidatePath("/purchase-requests");
    revalidateSerialGovernance();
    revalidatePath("/dashboard");
    revalidateTag("dashboard-metrics");
    revalidateTag(LIST_CACHE_TAGS.inbox);
  });

  return { ok: true, prId, reservationId: result.reservation.id };
}

export async function getSerialReservationByPRId(prId: string) {
  await requireRoles([...SM_OPS_OR_ADMIN_ROLES]);
  const reservation = await prisma.serialReservation.findFirst({
    where: { prId },
    include: {
      createdBy: { select: { name: true } },
      warehouse: { select: { name: true, location: true } },
    },
  });
  if (!reservation) {
    return null;
  }
  return {
    id: reservation.id,
    series: reservation.series,
    seriesName: await seriesDisplayName(reservation.series),
    rangeStart: reservation.rangeStart.toString(),
    rangeEnd: reservation.rangeEnd.toString(),
    quantity: reservation.quantity,
    warehouseName: reservation.warehouse
      ? formatWarehouseLabel(
          reservation.warehouse.name,
          reservation.warehouse.location,
        )
      : "All warehouses",
    createdByName: reservation.createdBy.name,
    createdAt: reservation.createdAt.toISOString(),
    prId: reservation.prId,
  };
}

export async function generateSerialCSV(reservationId: string): Promise<string | null> {
  await requireRoles([...OPS_OR_ADMIN_ROLES]);
  const r = await prisma.serialReservation.findUnique({ where: { id: reservationId } });
  if (!r) {
    return null;
  }
  return serialRangeToCsv(r.rangeStart, r.rangeEnd);
}

export async function generateVendorLockTagSerialCSV(poId: string): Promise<string | null> {
  await requireRoles([...OPS_OR_ADMIN_ROLES]);
  const r = await prisma.serialReservation.findUnique({ where: { poId } });
  if (!r || r.series !== SERIES_CODES.LOCK_TAGS) {
    return null;
  }
  return serialRangeToCsv(r.rangeStart, r.rangeEnd);
}

function serialRangeToCsv(rangeStart: bigint, rangeEnd: bigint): string {
  const lines = ["serial"];
  for (let n = rangeStart; n <= rangeEnd; n++) {
    lines.push(n.toString());
  }
  return lines.join("\n");
}

export async function generateSerialLabelTxt(reservationId: string): Promise<string | null> {
  await requireRoles([...OPS_OR_ADMIN_ROLES]);
  const r = await prisma.serialReservation.findUnique({ where: { id: reservationId } });
  if (!r) {
    return null;
  }
  const nums: string[] = [];
  for (let n = r.rangeStart; n <= r.rangeEnd; n++) {
    nums.push(n.toString());
  }
  return nums.join("\t");
}

export async function getSerialActivity(filters: SerialActivityFilters) {
  await requireRoles([...SM_OPS_OR_ADMIN_ROLES]);
  return getSerialActivityQuery(filters);
}

export async function getWarehouseSeriesSnapshot(ensureWarehouseIds?: string[]) {
  await requireRoles([...SM_OPS_OR_ADMIN_ROLES]);
  return getWarehouseSeriesSnapshotQuery({ ensureWarehouseIds });
}

export async function getSeriesConfigsForAdvanced() {
  await requireRoles([...OPS_OR_ADMIN_ROLES]);
  return getSeriesConfigsForAdvancedQuery();
}

export async function searchSerialNumber(serialNumber: string) {
  await requireRoles([...SM_OPS_OR_ADMIN_ROLES]);
  return searchSerialNumberQuery(serialNumber);
}

export async function getSerialGovernanceFilterOptions() {
  await requireRoles([...SM_OPS_OR_ADMIN_ROLES]);
  return getSerialGovernanceFilterOptionsQuery();
}

export async function updateSeriesConfig(
  series: SeriesCode,
  config: {
    ceilingNumber: string;
  },
): Promise<MutationResult> {
  const user = await requireRoles([...OPS_OR_ADMIN_ROLES]);

  let ceilingNumber: bigint;
  try {
    ceilingNumber = BigInt(config.ceilingNumber.trim());
  } catch {
    return { ok: false, message: "Invalid ceiling number." };
  }
  if (ceilingNumber <= BigInt(0)) {
    return { ok: false, message: "Ceiling must be greater than zero." };
  }

  const registry = await getCachedSeriesRegistry();

  const resolved = resolveSeriesCeiling(series, ceilingNumber, registry);
  if (resolved !== ceilingNumber) {
    return {
      ok: false,
      message: "Ceiling must be at or above the series start number.",
    };
  }

  const entry = registry.byCode.get(series);

  await prisma.seriesConfig.upsert({
    where: { code: series },
    update: {
      ceilingNumber,
      configuredById: user.id,
      configuredAt: new Date(),
    },
    create: {
      code: series,
      displayName: entry?.displayName ?? (await seriesDisplayName(series)),
      prefixPattern: getSeriesPrefix(series, registry),
      rangeStart: getSeriesStartNumber(series, registry),
      inactivityThresholdDays: 30,
      ceilingAlertPct: 80,
      sortOrder: 0,
      isActive: true,
      ceilingNumber,
      configuredById: user.id,
    },
  });

  revalidateTag("series-configs");
  revalidateSerialGovernance();

  return { ok: true };
}

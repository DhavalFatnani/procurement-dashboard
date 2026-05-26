"use server";

import { PRStatus, Role, SerialSeries } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";

import type { MutationResult } from "@/lib/action-result";
import { revalidateDashboardMetrics } from "@/lib/revalidate-tags";

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
import { assertPRStatusTransition } from "@/lib/prStatus";
import {
  computeNextRangeStart,
  formatSerialNumberForSeries,
  getSeriesDisplayName,
  resolveSeriesCeiling,
  validateInternalPrintQuantity,
  validReservationsForSeriesWhere,
} from "@/lib/serial-series";
import { atomicReserveSerialRange } from "@/lib/serialReservation";
import { requireRoles } from "@/lib/server-action-guard";
import { assertUserWarehouseAccess } from "@/lib/warehouse-access";

export type {
  SerialActivityFilters,
  SerialActivityRow,
  SerialSearchResult,
  SeriesConfigSummary,
  WarehouseSeriesSnapshot,
} from "@/lib/queries/serial";

const WAREHOUSE_SCOPE_ERROR = "You cannot reserve serials for this warehouse.";

export async function getSerialSeriesHint(subcategoryId: string) {
  await requireRoles([Role.SM, Role.OPS_HEAD]);
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
    seriesName: getSeriesDisplayName(sub.series),
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
  const user = await requireRoles([Role.SM, Role.OPS_HEAD]);

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

  let prId = input.prId;
  if (!prId) {
    prId = newPurchaseRequestId();
    await prisma.purchaseRequest.create({
      data: {
        id: prId,
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId,
        quantity: input.quantity,
        warehouseId: input.warehouseId,
        executionType: sub.executionType,
        status: PRStatus.DRAFT,
        createdById: user.id,
        lines: {
          create: {
            lineNumber: 1,
            categoryId: input.categoryId,
            subcategoryId: input.subcategoryId,
            quantity: input.quantity,
          },
        },
      },
    });
  }

  const pr = await prisma.purchaseRequest.findUnique({ where: { id: prId } });
  if (!pr) {
    return { ok: false, error: "Purchase request not found." };
  }

  const result = await atomicReserveSerialRange({
    series: sub.series,
    quantity: input.quantity,
    warehouseId: input.warehouseId,
    createdById: user.id,
    prId,
    idempotencyKey: input.idempotencyKey,
  });

  if (!result.success) {
    return { ok: false, error: result.error };
  }

  try {
    assertPRStatusTransition(pr.status, PRStatus.EXECUTED_PRINT);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid status." };
  }

  await prisma.purchaseRequest.update({
    where: { id: prId },
    data: { status: PRStatus.EXECUTED_PRINT },
  });

  revalidatePath("/purchase-requests");
  revalidatePath(`/purchase-requests/${prId}`);
  revalidatePath("/serial-governance");
  revalidatePath("/dashboard");
  revalidateDashboardMetrics();

  return { ok: true, prId, reservationId: result.reservation.id };
}

export async function getSerialReservationByPRId(prId: string) {
  await requireRoles([Role.SM, Role.OPS_HEAD]);
  const reservation = await prisma.serialReservation.findFirst({
    where: { prId },
    include: {
      createdBy: { select: { name: true } },
      warehouse: { select: { name: true } },
    },
  });
  if (!reservation) {
    return null;
  }
  return {
    id: reservation.id,
    series: reservation.series,
    rangeStart: reservation.rangeStart.toString(),
    rangeEnd: reservation.rangeEnd.toString(),
    quantity: reservation.quantity,
    warehouseName: reservation.warehouse.name,
    createdByName: reservation.createdBy.name,
    createdAt: reservation.createdAt.toISOString(),
    prId: reservation.prId,
  };
}

export async function generateSerialCSV(reservationId: string): Promise<string | null> {
  await requireRoles([Role.SM, Role.OPS_HEAD]);
  const r = await prisma.serialReservation.findUnique({ where: { id: reservationId } });
  if (!r) {
    return null;
  }
  const lines = ["serial"];
  for (let n = r.rangeStart; n <= r.rangeEnd; n++) {
    lines.push(n.toString());
  }
  return lines.join("\n");
}

export async function generateSerialLabelTxt(reservationId: string): Promise<string | null> {
  await requireRoles([Role.SM, Role.OPS_HEAD]);
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
  await requireRoles([Role.SM, Role.OPS_HEAD]);
  return getSerialActivityQuery(filters);
}

export async function getWarehouseSeriesSnapshot(ensureWarehouseIds?: string[]) {
  await requireRoles([Role.SM, Role.OPS_HEAD]);
  return getWarehouseSeriesSnapshotQuery({ ensureWarehouseIds });
}

export async function getSeriesConfigsForAdvanced() {
  await requireRoles([Role.OPS_HEAD]);
  return getSeriesConfigsForAdvancedQuery();
}

export async function searchSerialNumber(serialNumber: string) {
  await requireRoles([Role.SM, Role.OPS_HEAD]);
  return searchSerialNumberQuery(serialNumber);
}

export async function getSerialGovernanceFilterOptions() {
  await requireRoles([Role.SM, Role.OPS_HEAD]);
  return getSerialGovernanceFilterOptionsQuery();
}

export async function updateSeriesConfig(
  series: SerialSeries,
  config: {
    ceilingNumber: string;
  },
): Promise<MutationResult> {
  const user = await requireRoles([Role.OPS_HEAD]);

  let ceilingNumber: bigint;
  try {
    ceilingNumber = BigInt(config.ceilingNumber.trim());
  } catch {
    return { ok: false, message: "Invalid ceiling number." };
  }
  if (ceilingNumber <= BigInt(0)) {
    return { ok: false, message: "Ceiling must be greater than zero." };
  }

  const resolved = resolveSeriesCeiling(series, ceilingNumber);
  if (resolved !== ceilingNumber) {
    return {
      ok: false,
      message: "Ceiling must be at or above the series start number.",
    };
  }

  await prisma.seriesConfig.upsert({
    where: { series },
    update: {
      ceilingNumber,
      configuredById: user.id,
      configuredAt: new Date(),
    },
    create: {
      series,
      inactivityThresholdDays: 30,
      ceilingAlertPct: 80,
      ceilingNumber,
      configuredById: user.id,
    },
  });

  revalidateTag("series-configs");
  revalidatePath("/serial-governance");

  return { ok: true };
}

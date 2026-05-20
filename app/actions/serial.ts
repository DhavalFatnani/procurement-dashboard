"use server";

import { PRStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { newPurchaseRequestId } from "@/lib/ids";
import { prisma } from "@/lib/prisma";
import { assertPRStatusTransition } from "@/lib/prStatus";
import { atomicReserveSerialRange } from "@/lib/serialReservation";
import { requireRoles } from "@/lib/server-action-guard";

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
    where: { series: sub.series },
    orderBy: { rangeEnd: "desc" },
  });

  const lastEnd = latest?.rangeEnd ?? null;
  const nextStart = lastEnd != null ? lastEnd + BigInt(1) : null;

  return {
    categoryName: sub.category.name,
    series: sub.series,
    executionType: sub.executionType,
    lastRangeEnd: lastEnd?.toString() ?? null,
    nextStart: nextStart?.toString() ?? null,
  };
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

  const sub = await prisma.subcategory.findUnique({ where: { id: input.subcategoryId } });
  if (!sub?.series) {
    return { ok: false, error: "Subcategory has no serial series." };
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

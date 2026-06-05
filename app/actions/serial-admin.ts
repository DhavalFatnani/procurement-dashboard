"use server";

import { revalidatePath } from "next/cache";

import type { MutationResult } from "@/lib/action-result";
import { ADMIN_ONLY_ROLES } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { revalidateSerialGovernance } from "@/lib/revalidate-tags";
import type { SeriesCode } from "@/lib/series-codes";
import {
  adminBlockSerialRange,
  adminReassignReservation,
  adminSplitReservation,
  parseAdminSerialRange,
  softReleaseReservation,
} from "@/lib/serial-admin";
import { requireRoles } from "@/lib/server-action-guard";

async function guardAdminOnly() {
  return requireRoles([...ADMIN_ONLY_ROLES]);
}

export async function adminReleaseSerialReservation(
  reservationId: string,
  reason: string,
): Promise<MutationResult> {
  const user = await guardAdminOnly();
  const trimmed = reason.trim();
  if (!trimmed) {
    return { ok: false, message: "Reason is required." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await softReleaseReservation(tx, {
        reservationId,
        actorId: user.id,
        reason: trimmed,
      });
    });
    revalidateSerialGovernance();
    revalidatePath("/admin/platform");
    revalidatePath("/admin/platform/serial");
    revalidatePath("/serial-governance/range-map");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Release failed.",
    };
  }
}

export async function adminBlockSerialRangeAction(input: {
  series: SeriesCode;
  rangeStart: string;
  rangeEnd: string;
  reason: string;
  /** Omit or "global" for all warehouses; "warehouse" requires warehouseId */
  scope?: "global" | "warehouse";
  warehouseId?: string | null;
}): Promise<MutationResult> {
  const user = await guardAdminOnly();
  const scope = input.scope ?? "global";
  if (scope === "warehouse" && !input.warehouseId?.trim()) {
    return { ok: false, message: "Select a warehouse for a warehouse-scoped block." };
  }

  try {
    const { rangeStart, rangeEnd } = await parseAdminSerialRange(
      input.series,
      input.rangeStart,
      input.rangeEnd,
    );
    await prisma.$transaction(async (tx) => {
      await adminBlockSerialRange(tx, {
        actorId: user.id,
        series: input.series,
        rangeStart,
        rangeEnd,
        warehouseId: scope === "global" ? null : input.warehouseId!.trim(),
        reason: input.reason,
      });
    });
    revalidateSerialGovernance();
    revalidatePath("/admin/platform/serial");
    revalidatePath("/serial-governance/range-map");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Block failed.",
    };
  }
}

export async function adminSplitSerialReservationAction(input: {
  reservationId: string;
  splitQuantity: number;
  reason: string;
}): Promise<MutationResult> {
  const user = await guardAdminOnly();
  try {
    await prisma.$transaction(async (tx) => {
      await adminSplitReservation(tx, {
        actorId: user.id,
        reservationId: input.reservationId,
        splitQuantity: input.splitQuantity,
        reason: input.reason,
      });
    });
    revalidateSerialGovernance();
    revalidatePath("/admin/platform/serial");
    revalidatePath("/serial-governance/range-map");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Split failed.",
    };
  }
}

export async function adminReassignSerialReservationAction(input: {
  reservationId: string;
  prId?: string | null;
  poId?: string | null;
  reason: string;
}): Promise<MutationResult> {
  const user = await guardAdminOnly();
  try {
    await prisma.$transaction(async (tx) => {
      await adminReassignReservation(tx, {
        actorId: user.id,
        reservationId: input.reservationId,
        prId: input.prId,
        poId: input.poId,
        reason: input.reason,
      });
    });
    revalidateSerialGovernance();
    revalidatePath("/admin/platform/serial");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Reassign failed.",
    };
  }
}

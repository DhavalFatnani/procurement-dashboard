"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import type { MutationResult } from "@/lib/action-result";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { ADMIN_ONLY_ROLES } from "@/lib/admin-access";
import { getCachedSeriesRegistry } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { AdminAuditAction } from "@/lib/prisma-enums";
import { revalidateSerialGovernance } from "@/lib/revalidate-tags";
import { assertSeriesCode, normalizeSeriesCode } from "@/lib/series-codes";
import {
  normalizePrefixPattern,
  validateRangeAlignsWithPrefixPattern,
} from "@/lib/series-prefix-pattern";
import {
  getSeriesEntry,
  validateSeriesBand,
  type SeriesRegistry,
} from "@/lib/series-registry";
import { requireRoles } from "@/lib/server-action-guard";

function normalizeDisplayName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Display name is required.");
  }
  if (trimmed.length > 80) {
    throw new Error("Display name must be 80 characters or fewer.");
  }
  return trimmed;
}

function parseBigIntField(value: string, label: string): bigint {
  try {
    const parsed = BigInt(value.trim());
    if (parsed <= BigInt(0)) {
      throw new Error(`${label} must be greater than zero.`);
    }
    return parsed;
  } catch (err) {
    if (err instanceof Error && err.message.includes("must be")) {
      throw err;
    }
    throw new Error(`Invalid ${label.toLowerCase()}.`);
  }
}

function validateThresholds(input: {
  inactivityThresholdDays: number;
  ceilingAlertPct: number;
}): string | null {
  if (
    input.inactivityThresholdDays < 1 ||
    input.inactivityThresholdDays > 365 ||
    !Number.isInteger(input.inactivityThresholdDays)
  ) {
    return "Inactivity threshold must be between 1 and 365 days.";
  }
  if (
    input.ceilingAlertPct < 1 ||
    input.ceilingAlertPct > 100 ||
    !Number.isInteger(input.ceilingAlertPct)
  ) {
    return "Ceiling alert must be between 1 and 100 percent.";
  }
  return null;
}

async function loadRegistry(): Promise<SeriesRegistry> {
  return getCachedSeriesRegistry();
}

export async function createSeriesAdminAction(input: {
  code: string;
  displayName: string;
  prefixPattern: string;
  rangeStart: string;
  ceilingNumber: string;
  inactivityThresholdDays: number;
  ceilingAlertPct: number;
  sortOrder: number;
  reason: string;
}): Promise<MutationResult> {
  const user = await requireRoles([...ADMIN_ONLY_ROLES]);
  const trimmedReason = input.reason.trim();
  if (!trimmedReason) {
    return { ok: false, message: "Reason is required." };
  }

  try {
    const code = assertSeriesCode(input.code);
    const displayName = normalizeDisplayName(input.displayName);
    const prefixPattern = normalizePrefixPattern(input.prefixPattern);
    const rangeStart = parseBigIntField(input.rangeStart, "Range start");
    const ceilingNumber = parseBigIntField(input.ceilingNumber, "Ceiling");
    const thresholdError = validateThresholds(input);
    if (thresholdError) {
      return { ok: false, message: thresholdError };
    }
    const alignmentError = validateRangeAlignsWithPrefixPattern({
      prefixPattern,
      rangeStart,
      ceilingNumber,
    });
    if (alignmentError) {
      return { ok: false, message: alignmentError };
    }

    const registry = await loadRegistry();
    if (getSeriesEntry(registry, code)) {
      return { ok: false, message: "A series with this code already exists." };
    }

    const overlapError = validateSeriesBand({ rangeStart, ceilingNumber }, registry);
    if (overlapError) {
      return { ok: false, message: overlapError };
    }

    await prisma.$transaction(async (tx) => {
      const row = await tx.seriesConfig.create({
        data: {
          code,
          displayName,
          prefixPattern,
          rangeStart,
          ceilingNumber,
          inactivityThresholdDays: input.inactivityThresholdDays,
          ceilingAlertPct: input.ceilingAlertPct,
          sortOrder: input.sortOrder,
          isActive: true,
          configuredById: user.id,
        },
      });

      await writeAdminAuditLog(
        {
          actorId: user.id,
          action: AdminAuditAction.SERIES_CONFIG_CREATE,
          targetType: "SeriesConfig",
          targetId: row.id,
          reason: trimmedReason,
          metadata: {
            code,
            displayName,
            prefixPattern,
            rangeStart: rangeStart.toString(),
            ceilingNumber: ceilingNumber.toString(),
            sortOrder: input.sortOrder,
          },
        },
        tx,
      );
    });

    revalidateTag("series-configs");
    revalidateSerialGovernance();
    revalidatePath("/admin/platform");
    revalidatePath("/admin/platform/series");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Create failed.",
    };
  }
}

export async function upsertSeriesConfigAdminAction(input: {
  code: string;
  displayName: string;
  prefixPattern: string;
  rangeStart: string;
  ceilingNumber: string;
  inactivityThresholdDays: number;
  ceilingAlertPct: number;
  sortOrder: number;
  isActive: boolean;
  reason: string;
}): Promise<MutationResult> {
  const user = await requireRoles([...ADMIN_ONLY_ROLES]);
  const trimmedReason = input.reason.trim();
  if (!trimmedReason) {
    return { ok: false, message: "Reason is required." };
  }

  try {
    const code = assertSeriesCode(input.code);
    const displayName = normalizeDisplayName(input.displayName);
    const prefixPattern = normalizePrefixPattern(input.prefixPattern);
    const rangeStart = parseBigIntField(input.rangeStart, "Range start");
    const ceilingNumber = parseBigIntField(input.ceilingNumber, "Ceiling");
    const thresholdError = validateThresholds(input);
    if (thresholdError) {
      return { ok: false, message: thresholdError };
    }
    if (!Number.isInteger(input.sortOrder)) {
      return { ok: false, message: "Sort order must be an integer." };
    }
    const alignmentError = validateRangeAlignsWithPrefixPattern({
      prefixPattern,
      rangeStart,
      ceilingNumber,
    });
    if (alignmentError) {
      return { ok: false, message: alignmentError };
    }

    const registry = await loadRegistry();
    const existing = getSeriesEntry(registry, code);
    if (!existing) {
      return { ok: false, message: "Series not found." };
    }

    if (!input.isActive) {
      const [reservationCount, subcategoryCount] = await Promise.all([
        prisma.serialReservation.count({ where: { series: code } }),
        prisma.subcategory.count({ where: { series: code } }),
      ]);
      if (reservationCount > 0 || subcategoryCount > 0) {
        return {
          ok: false,
          message:
            "Cannot deactivate a series linked to reservations or subcategories. Remove links first.",
        };
      }
    }

    const overlapError = validateSeriesBand(
      { code, rangeStart, ceilingNumber },
      registry,
    );
    if (overlapError) {
      return { ok: false, message: overlapError };
    }

    await prisma.$transaction(async (tx) => {
      const row = await tx.seriesConfig.update({
        where: { code },
        data: {
          displayName,
          prefixPattern,
          rangeStart,
          ceilingNumber,
          inactivityThresholdDays: input.inactivityThresholdDays,
          ceilingAlertPct: input.ceilingAlertPct,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
          configuredById: user.id,
          configuredAt: new Date(),
        },
      });

      await writeAdminAuditLog(
        {
          actorId: user.id,
          action: AdminAuditAction.SERIES_CONFIG_UPDATE,
          targetType: "SeriesConfig",
          targetId: row.id,
          reason: trimmedReason,
          metadata: {
            code,
            displayName,
            prefixPattern,
            rangeStart: rangeStart.toString(),
            ceilingNumber: ceilingNumber.toString(),
            inactivityThresholdDays: input.inactivityThresholdDays,
            ceilingAlertPct: input.ceilingAlertPct,
            sortOrder: input.sortOrder,
            isActive: input.isActive,
          },
        },
        tx,
      );
    });

    revalidateTag("series-configs");
    revalidateSerialGovernance();
    revalidatePath("/admin/platform");
    revalidatePath("/admin/platform/series");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Save failed.",
    };
  }
}

export async function deleteSeriesAdminAction(input: {
  code: string;
  reason: string;
}): Promise<MutationResult> {
  const user = await requireRoles([...ADMIN_ONLY_ROLES]);
  const trimmedReason = input.reason.trim();
  if (!trimmedReason) {
    return { ok: false, message: "Reason is required." };
  }

  try {
    const code = normalizeSeriesCode(input.code);
    const existing = await prisma.seriesConfig.findUnique({ where: { code } });
    if (!existing) {
      return { ok: true };
    }

    const [reservationCount, subcategoryCount] = await Promise.all([
      prisma.serialReservation.count({ where: { series: code } }),
      prisma.subcategory.count({ where: { series: code } }),
    ]);
    if (reservationCount > 0 || subcategoryCount > 0) {
      return {
        ok: false,
        message:
          "Cannot delete a series with reservations or subcategory links. Deactivate instead.",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.seriesConfig.delete({ where: { code } });
      await writeAdminAuditLog(
        {
          actorId: user.id,
          action: AdminAuditAction.SERIES_CONFIG_DEACTIVATE,
          targetType: "SeriesConfig",
          targetId: existing.id,
          reason: trimmedReason,
          metadata: { code, action: "delete" },
        },
        tx,
      );
    });

    revalidateTag("series-configs");
    revalidateSerialGovernance();
    revalidatePath("/admin/platform");
    revalidatePath("/admin/platform/series");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Delete failed.",
    };
  }
}

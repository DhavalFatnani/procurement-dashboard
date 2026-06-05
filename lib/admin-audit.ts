import "server-only";

import type { AdminAuditAction, Prisma } from "@/lib/prisma-client";

import { prisma } from "@/lib/prisma";
import type { PrismaTx } from "@/lib/serialReservation";

export type WriteAdminAuditInput = {
  actorId: string;
  action: AdminAuditAction;
  targetType: string;
  targetId?: string | null;
  reason: string;
  metadata?: Prisma.InputJsonValue;
};

export async function writeAdminAuditLog(
  input: WriteAdminAuditInput,
  tx: PrismaTx = prisma,
): Promise<void> {
  await tx.adminAuditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      reason: input.reason.trim(),
      metadata: input.metadata ?? undefined,
    },
  });
}

export type AdminAuditLogRow = {
  id: string;
  action: AdminAuditAction;
  targetType: string;
  targetId: string | null;
  reason: string;
  actorName: string;
  createdAt: string;
  metadata: unknown;
};

export async function getRecentAdminAuditLogs(limit = 50): Promise<AdminAuditLogRow[]> {
  const rows = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: { name: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    reason: row.reason,
    actorName: row.actor.name,
    createdAt: row.createdAt.toISOString(),
    metadata: row.metadata,
  }));
}

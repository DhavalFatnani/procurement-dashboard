"use server";

import { POAdvanceRequestStatus, Prisma, Role } from "@/lib/prisma-client";

import {
  committedTotalFromPo,
  computeAdvanceBalances,
  validateAdvancePaymentAgainstCommitted,
} from "@/lib/po-advance";
import { PO_CLOSURE_TX_OPTS, schedulePOClosure } from "@/lib/poAutoClose";
import {
  getAdvanceRequestDetail as getAdvanceRequestDetailQuery,
  getPendingAdvanceRequests as getPendingAdvanceRequestsQuery,
  getPOAdvanceSummary as getPOAdvanceSummaryQuery,
} from "@/lib/queries/po-advance";
import type {
  AdvanceRequestDetail,
  AdvanceRequestListRow,
  POAdvanceSummary,
} from "@/lib/queries/po-advance";
import { revalidateAdvanceRequestsCache, revalidatePaymentMutation } from "@/lib/revalidate-tags";
import { requireRoles } from "@/lib/server-action-guard";
import { ALL_DASHBOARD_ROLES, FINANCE_OR_ADMIN_ROLES, OPS_FINANCE_OR_ADMIN_ROLES, OPS_OR_ADMIN_ROLES, SM_OPS_OR_ADMIN_ROLES } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { assertSessionPurchaseOrderAccess } from "@/lib/warehouse-access";
import { scopeWarehouseIdsForUser } from "@/lib/warehouse-scope";
import { STORAGE_BUCKETS } from "@/lib/storage";
import { uploadStorageObject } from "@/lib/upload-storage";

export async function getPendingAdvanceRequests(): Promise<AdvanceRequestListRow[]> {
  const user = await requireRoles([...OPS_FINANCE_OR_ADMIN_ROLES]);
  return getPendingAdvanceRequestsQuery(scopeWarehouseIdsForUser(user));
}

export async function getAdvanceRequestDetailForPay(
  requestId: string,
): Promise<AdvanceRequestDetail | null> {
  await requireRoles([...FINANCE_OR_ADMIN_ROLES]);
  return getAdvanceRequestDetailQuery(requestId);
}

export async function fetchPOAdvanceSummary(
  poId: string,
): Promise<POAdvanceSummary | null> {
  const user = await requireRoles([...ALL_DASHBOARD_ROLES]);
  const access = await assertSessionPurchaseOrderAccess(user, poId);
  if (!access.ok) {
    return null;
  }
  return getPOAdvanceSummaryQuery(poId);
}

export async function cancelAdvanceRequest(
  requestId: string,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRoles([...OPS_OR_ADMIN_ROLES]);

  const request = await prisma.pOAdvanceRequest.findUnique({
    where: { id: requestId },
    select: { poId: true, status: true },
  });
  if (!request) {
    return { ok: false, message: "Advance request not found." };
  }
  if (request.status !== POAdvanceRequestStatus.PENDING) {
    return { ok: false, message: "Only pending advance requests can be cancelled." };
  }

  const access = await assertSessionPurchaseOrderAccess(user, request.poId);
  if (!access.ok) {
    return { ok: false, message: access.message };
  }

  await prisma.pOAdvanceRequest.update({
    where: { id: requestId },
    data: { status: POAdvanceRequestStatus.CANCELLED },
  });

  revalidateAdvanceRequestsCache();
  revalidatePaymentMutation(request.poId);
  return { ok: true };
}

export async function rejectAdvanceRequest(
  requestId: string,
  reason: string,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRoles([...FINANCE_OR_ADMIN_ROLES]);

  const trimmed = reason.trim();
  if (!trimmed) {
    return { ok: false, message: "Rejection reason is required." };
  }

  const request = await prisma.pOAdvanceRequest.findUnique({
    where: { id: requestId },
    select: { poId: true, status: true },
  });
  if (!request) {
    return { ok: false, message: "Advance request not found." };
  }
  if (request.status !== POAdvanceRequestStatus.PENDING) {
    return { ok: false, message: "Only pending advance requests can be rejected." };
  }

  const access = await assertSessionPurchaseOrderAccess(user, request.poId);
  if (!access.ok) {
    return { ok: false, message: access.message };
  }

  await prisma.pOAdvanceRequest.update({
    where: { id: requestId },
    data: {
      status: POAdvanceRequestStatus.REJECTED,
      reviewedById: user.id,
      reviewReason: trimmed,
    },
  });

  revalidateAdvanceRequestsCache();
  revalidatePaymentMutation(request.poId);
  return { ok: true };
}

export async function recordAdvancePayment(
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRoles([...FINANCE_OR_ADMIN_ROLES]);

  const requestId = String(formData.get("requestId") ?? "").trim();
  const method = String(formData.get("method") ?? "").trim();
  const transactionRef = String(formData.get("transactionRef") ?? "").trim();
  const paidAtRaw = String(formData.get("paidAt") ?? "").trim();
  const proofFile = formData.get("proof");

  if (!requestId) {
    return { ok: false, message: "Advance request is required." };
  }
  if (!transactionRef) {
    return { ok: false, message: "Transaction reference is required." };
  }

  let paidAt: Date;
  if (paidAtRaw) {
    paidAt = new Date(paidAtRaw);
    if (Number.isNaN(paidAt.getTime())) {
      return { ok: false, message: "Invalid paid date." };
    }
  } else {
    return { ok: false, message: "Paid date is required." };
  }

  const request = await prisma.pOAdvanceRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      poId: true,
      requestedAmount: true,
      status: true,
      payment: { select: { id: true } },
      purchaseOrder: {
        select: {
          gstApplicable: true,
          gstRatePercent: true,
          lineItems: { select: { id: true, orderedQty: true, unitPrice: true } },
          lines: { select: { id: true, orderedQty: true, unitPrice: true } },
          lineAdjustments: {
            orderBy: { createdAt: "asc" },
            select: {
              poLineItemId: true,
              poLineId: true,
              originalOrderedQty: true,
              effectiveOrderedQty: true,
              originalUnitPrice: true,
              effectiveUnitPrice: true,
              createdAt: true,
            },
          },
          advancePayments: { select: { amount: true } },
        },
      },
    },
  });

  if (!request) {
    return { ok: false, message: "Advance request not found." };
  }
  if (request.status !== POAdvanceRequestStatus.PENDING) {
    return { ok: false, message: "This advance request is no longer pending." };
  }
  if (request.payment) {
    return { ok: false, message: "This advance request has already been paid." };
  }

  const access = await assertSessionPurchaseOrderAccess(user, request.poId);
  if (!access.ok) {
    return { ok: false, message: access.message };
  }

  const payAmount = Number(request.requestedAmount);
  if (!Number.isFinite(payAmount) || payAmount <= 0) {
    return { ok: false, message: "Invalid advance request amount." };
  }

  const po = request.purchaseOrder;
  const committedTotal = committedTotalFromPo({
    gstApplicable: po.gstApplicable,
    gstRatePercent: po.gstRatePercent?.toString() ?? null,
    lineItems: [],
    lines: [],
    lineAdjustments: po.lineAdjustments,
    lineItemsWithIds: po.lineItems.map((l) => ({
      id: l.id,
      orderedQty: l.orderedQty,
      unitPrice: Number(l.unitPrice),
    })),
    linesWithIds: po.lines.map((l) => ({
      id: l.id,
      orderedQty: l.orderedQty,
      unitPrice: Number(l.unitPrice),
    })),
  });
  const { advancePaid } = computeAdvanceBalances(
    po.advancePayments.map((p) => ({ amount: p.amount })),
  );
  const capCheck = validateAdvancePaymentAgainstCommitted(
    committedTotal,
    advancePaid,
    payAmount,
  );
  if (!capCheck.ok) {
    return { ok: false, message: capCheck.message };
  }

  let proofUrl: string | undefined;
  if (proofFile instanceof File && proofFile.size > 0) {
    const bytes = new Uint8Array(await proofFile.arrayBuffer());
    const safeName = proofFile.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
    const storagePath = `${request.poId}/${requestId}/${Date.now()}-${safeName}`;
    const upload = await uploadStorageObject(
      STORAGE_BUCKETS.paymentProofs,
      storagePath,
      bytes,
      proofFile.type || "application/octet-stream",
    );
    if (!upload.ok) {
      return { ok: false, message: upload.message };
    }
    proofUrl = storagePath;
  }

  await prisma.$transaction(async (tx) => {
    await tx.pOAdvancePayment.create({
      data: {
        poId: request.poId,
        requestId: request.id,
        amount: new Prisma.Decimal(payAmount),
        method: method || null,
        transactionRef,
        paidAt,
        paidById: user.id,
        proofUrl: proofUrl ?? null,
      },
    });

    await tx.pOAdvanceRequest.update({
      where: { id: requestId },
      data: { status: POAdvanceRequestStatus.FULFILLED },
    });

  }, PO_CLOSURE_TX_OPTS);

  revalidateAdvanceRequestsCache();
  revalidatePaymentMutation(request.poId);
  schedulePOClosure(request.poId);
  return { ok: true };
}

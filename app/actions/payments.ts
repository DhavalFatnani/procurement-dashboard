"use server";

import { InvoiceMatchStatus, PaymentStatus, Prisma, Role } from "@/lib/prisma-client";

import { PO_CLOSURE_TX_OPTS, schedulePOClosure } from "@/lib/poAutoClose";
import type { Paginated } from "@/lib/pagination";
import {
  computeAdvanceBalances,
  deriveInvoiceSettledStatus,
  fifoAdvanceAllocationChunks,
  invoiceRemainingBeforeCash,
  sumAllocationsForInvoice,
  sumCashPaidForInvoice,
  validateAdvanceAllocation,
} from "@/lib/po-advance";
import {
  getInvoicePaymentDetail as getInvoicePaymentDetailQuery,
  getPaymentFilterOptions as getPaymentFilterOptionsQuery,
  getPayments as getPaymentsQuery,
} from "@/lib/queries/payments";
import type {
  InvoicePaymentDetail,
  PaymentFilters,
  PaymentListRow,
} from "@/lib/queries/payments";
import { revalidatePaymentMutation } from "@/lib/revalidate-tags";
import { requireRoles } from "@/lib/server-action-guard";
import { STORAGE_BUCKETS } from "@/lib/storage";
import { uploadStorageObject } from "@/lib/upload-storage";
import { prisma } from "@/lib/prisma";
import { assertSessionInvoiceAccess } from "@/lib/warehouse-access";
import { assignedWarehouseIds } from "@/lib/warehouse-scope";

export async function getPayments(
  filters: PaymentFilters,
): Promise<Paginated<PaymentListRow>> {
  const user = await requireRoles([Role.OPS_HEAD, Role.FINANCE]);
  return getPaymentsQuery({
    ...filters,
    scopeWarehouseIds: filters.scopeWarehouseIds ?? assignedWarehouseIds(user),
  });
}

export async function getPaymentFilterOptions() {
  await requireRoles([Role.OPS_HEAD, Role.FINANCE]);
  return getPaymentFilterOptionsQuery();
}

export async function getInvoicePaymentDetail(
  invoiceId: string,
): Promise<InvoicePaymentDetail | null> {
  const user = await requireRoles([Role.FINANCE]);
  const access = await assertSessionInvoiceAccess(user, invoiceId);
  if (!access.ok) {
    return null;
  }
  return getInvoicePaymentDetailQuery(invoiceId);
}

export async function recordPayment(
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRoles([Role.FINANCE]);

  const invoiceId = String(formData.get("invoiceId") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const allocationRaw = String(formData.get("advanceAllocation") ?? "").trim();
  const method = String(formData.get("method") ?? "").trim();
  const transactionRef = String(formData.get("transactionRef") ?? "").trim();
  const paidAtRaw = String(formData.get("paidAt") ?? "").trim();
  const proofFile = formData.get("proof");

  if (!invoiceId) {
    return { ok: false, message: "Invoice is required." };
  }

  const invoiceAccess = await assertSessionInvoiceAccess(user, invoiceId);
  if (!invoiceAccess.ok) {
    return { ok: false, message: invoiceAccess.message };
  }

  const cashAmount = amountRaw === "" ? 0 : Number(amountRaw);
  const allocationAmount = allocationRaw === "" ? 0 : Number(allocationRaw);

  if (!Number.isFinite(cashAmount) || cashAmount < 0) {
    return { ok: false, message: "Enter a valid cash payment amount." };
  }
  if (!Number.isFinite(allocationAmount) || allocationAmount < 0) {
    return { ok: false, message: "Enter a valid advance allocation amount." };
  }
  if (cashAmount <= 0 && allocationAmount <= 0) {
    return {
      ok: false,
      message: "Apply advance credit and/or enter a cash payment amount.",
    };
  }

  if (cashAmount > 0 && !transactionRef) {
    return { ok: false, message: "Transaction reference is required for cash payment." };
  }

  let paidAt: Date | null = null;
  if (cashAmount > 0) {
    if (!paidAtRaw) {
      return { ok: false, message: "Paid date is required when recording cash." };
    }
    paidAt = new Date(paidAtRaw);
    if (Number.isNaN(paidAt.getTime())) {
      return { ok: false, message: "Invalid paid date." };
    }
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      poId: true,
      amount: true,
      matchStatus: true,
      paymentStatus: true,
      payments: { select: { amount: true } },
      advanceAllocations: { select: { amount: true } },
    },
  });

  if (!invoice) {
    return { ok: false, message: "Invoice not found." };
  }

  if (invoice.paymentStatus === PaymentStatus.PAID) {
    return { ok: false, message: "This invoice is already fully settled." };
  }

  if (invoice.matchStatus === InvoiceMatchStatus.MISMATCH) {
    return {
      ok: false,
      message: "Payment is gated until an Ops Head records a match override.",
    };
  }

  const invoiceAmount = Number(invoice.amount);
  const remainingBeforeCash = invoiceRemainingBeforeCash(invoice);

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: invoice.poId },
    select: {
      advancePayments: {
        include: {
          allocations: { select: { amount: true } },
        },
        orderBy: { paidAt: "asc" },
      },
    },
  });

  if (!po) {
    return { ok: false, message: "Purchase order not found." };
  }

  const { advanceUnallocated } = computeAdvanceBalances(po.advancePayments);

  const allocCheck = validateAdvanceAllocation(
    allocationAmount,
    advanceUnallocated,
    remainingBeforeCash,
  );
  if (!allocCheck.ok) {
    return { ok: false, message: allocCheck.message };
  }

  const totalSettlement = allocationAmount + cashAmount;
  if (totalSettlement > remainingBeforeCash + 0.001) {
    return {
      ok: false,
      message: `Total settlement exceeds remaining invoice balance (${remainingBeforeCash.toFixed(2)}).`,
    };
  }

  const fifoPayments = po.advancePayments.map((p) => ({
    id: p.id,
    paidAt: p.paidAt,
    amount: Number(p.amount),
    allocated: p.allocations.reduce((s, a) => s + Number(a.amount), 0),
  }));
  const allocationChunks = fifoAdvanceAllocationChunks(fifoPayments, allocationAmount);
  const chunkSum = allocationChunks.reduce((s, c) => s + c.amount, 0);
  if (Math.abs(chunkSum - allocationAmount) > 0.01) {
    return {
      ok: false,
      message: "Not enough unallocated advance on this PO for that allocation.",
    };
  }

  let proofUrl: string | undefined;
  if (cashAmount > 0 && proofFile instanceof File && proofFile.size > 0) {
    const bytes = new Uint8Array(await proofFile.arrayBuffer());
    const safeName = proofFile.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
    const storagePath = `${invoiceId}/${Date.now()}-${safeName}`;
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

  const existingCash = sumCashPaidForInvoice(invoice);
  const existingAlloc = sumAllocationsForInvoice(invoice);
  const nextStatus = deriveInvoiceSettledStatus(
    invoiceAmount,
    existingCash + cashAmount,
    existingAlloc + allocationAmount,
  );

  await prisma.$transaction(async (tx) => {
    for (const chunk of allocationChunks) {
      await tx.pOAdvanceAllocation.create({
        data: {
          advancePaymentId: chunk.advancePaymentId,
          invoiceId,
          amount: new Prisma.Decimal(chunk.amount),
        },
      });
    }

    if (cashAmount > 0) {
      await tx.payment.create({
        data: {
          invoiceId,
          status: PaymentStatus.PAID,
          amount: new Prisma.Decimal(cashAmount),
          method: method || null,
          transactionRef,
          paidAt: paidAt!,
          paidById: user.id,
          proofUrl: proofUrl ?? null,
        },
      });
    }

    await tx.invoice.update({
      where: { id: invoiceId },
      data: { paymentStatus: nextStatus },
    });

  }, PO_CLOSURE_TX_OPTS);

  revalidatePaymentMutation(invoice.poId);
  schedulePOClosure(invoice.poId);

  return { ok: true };
}

/** @deprecated Use recordPayment — kept for any stale client bundles. */
export async function updatePayment(
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  return recordPayment(formData);
}

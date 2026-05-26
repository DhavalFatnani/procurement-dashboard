"use server";

import { InvoiceMatchStatus, PaymentStatus, Prisma, Role } from "@prisma/client";

import { applyPOClosureInTransaction, PO_CLOSURE_TX_OPTS } from "@/lib/poAutoClose";
import type { Paginated } from "@/lib/pagination";
import {
  deriveInvoicePaymentStatus,
  sumPaymentAmounts,
} from "@/lib/payment-totals";
import {
  getInvoicePaymentDetail as getInvoicePaymentDetailQuery,
  getPaymentFilterOptions as getPaymentFilterOptionsQuery,
  getPayments as getPaymentsQuery,
} from "@/lib/queries/payments";
import type {
  InvoicePaymentDetail,
  PaymentEntry,
  PaymentFilters,
  PaymentListRow,
} from "@/lib/queries/payments";
import { revalidatePaymentMutation } from "@/lib/revalidate-tags";
import { requireRoles } from "@/lib/server-action-guard";
import { STORAGE_BUCKETS } from "@/lib/storage";
import { uploadStorageObject } from "@/lib/upload-storage";
import { prisma } from "@/lib/prisma";

// Re-export types directly from the source module — Turbopack mishandles the
// `import type … → export type …` indirection inside `"use server"` files.
export type {
  InvoicePaymentDetail,
  PaymentEntry,
  PaymentFilters,
  PaymentListRow,
} from "@/lib/queries/payments";

export async function getPayments(
  filters: PaymentFilters,
): Promise<Paginated<PaymentListRow>> {
  await requireRoles([Role.OPS_HEAD, Role.FINANCE]);
  return getPaymentsQuery(filters);
}

export async function getPaymentFilterOptions() {
  await requireRoles([Role.OPS_HEAD, Role.FINANCE]);
  return getPaymentFilterOptionsQuery();
}

export async function getInvoicePaymentDetail(
  invoiceId: string,
): Promise<InvoicePaymentDetail | null> {
  await requireRoles([Role.FINANCE]);
  return getInvoicePaymentDetailQuery(invoiceId);
}

export async function recordPayment(
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRoles([Role.FINANCE]);

  const invoiceId = String(formData.get("invoiceId") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const method = String(formData.get("method") ?? "").trim();
  const transactionRef = String(formData.get("transactionRef") ?? "").trim();
  const paidAtRaw = String(formData.get("paidAt") ?? "").trim();
  const proofFile = formData.get("proof");

  if (!invoiceId) {
    return { ok: false, message: "Invoice is required." };
  }

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Enter a valid payment amount greater than zero." };
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

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      poId: true,
      amount: true,
      matchStatus: true,
      paymentStatus: true,
      payments: { select: { amount: true } },
    },
  });

  if (!invoice) {
    return { ok: false, message: "Invoice not found." };
  }

  if (invoice.paymentStatus === PaymentStatus.PAID) {
    return { ok: false, message: "This invoice is already fully paid." };
  }

  if (invoice.matchStatus === InvoiceMatchStatus.MISMATCH) {
    return {
      ok: false,
      message: "Payment is gated until an Ops Head records a match override.",
    };
  }

  const invoiceAmount = Number(invoice.amount);
  const alreadyPaid = sumPaymentAmounts(invoice.payments);
  const remaining = invoiceAmount - alreadyPaid;

  if (amount > remaining) {
    return {
      ok: false,
      message: `Payment exceeds remaining balance (${remaining.toFixed(2)}).`,
    };
  }

  let proofUrl: string | undefined;
  if (proofFile instanceof File && proofFile.size > 0) {
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

  const totalPaid = alreadyPaid + amount;
  const nextStatus = deriveInvoicePaymentStatus(totalPaid, invoiceAmount);

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        invoiceId,
        status: PaymentStatus.PAID,
        amount: new Prisma.Decimal(amount),
        method: method || null,
        transactionRef,
        paidAt,
        paidById: user.id,
        proofUrl: proofUrl ?? null,
      },
    });

    await tx.invoice.update({
      where: { id: invoiceId },
      data: { paymentStatus: nextStatus },
    });

    await applyPOClosureInTransaction(tx, invoice.poId);
  }, PO_CLOSURE_TX_OPTS);

  revalidatePaymentMutation(invoice.poId);

  return { ok: true };
}

/** @deprecated Use recordPayment — kept for any stale client bundles. */
export async function updatePayment(
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  return recordPayment(formData);
}

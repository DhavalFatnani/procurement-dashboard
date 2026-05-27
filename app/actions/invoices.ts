"use server";

import { Role } from "@prisma/client";

import type { MutationResult } from "@/lib/action-result";
import { computeInvoiceMatchFromExpected } from "@/lib/invoiceMatch";
import { applyPOClosureInTransaction, PO_CLOSURE_TX_OPTS } from "@/lib/poAutoClose";
import type { Paginated } from "@/lib/pagination";
import {
  getGRNsForPO as getGRNsForPOQuery,
  getInvoiceById as getInvoiceByIdQuery,
  getInvoiceFilterOptions as getInvoiceFilterOptionsQuery,
  getInvoices as getInvoicesQuery,
  getPOForInvoiceById as getPOForInvoiceByIdQuery,
  getPOsForInvoice as getPOsForInvoiceQuery,
  searchPOsForInvoice as searchPOsForInvoiceQuery,
} from "@/lib/queries/invoices";
import type {
  InvoiceDetail,
  InvoiceFilters,
  InvoiceListRow,
  POForInvoiceOption,
} from "@/lib/queries/invoices";
import { revalidateInvoiceMutation } from "@/lib/revalidate-tags";
import { requireRoles } from "@/lib/server-action-guard";
import { STORAGE_BUCKETS } from "@/lib/storage";
import { uploadStorageObject } from "@/lib/upload-storage";
import { prisma } from "@/lib/prisma";
import {
  assertSessionInvoiceAccess,
  assertSessionPurchaseOrderAccess,
} from "@/lib/warehouse-access";
import { assignedWarehouseIds } from "@/lib/warehouse-scope";

export async function getInvoices(
  filters: InvoiceFilters,
): Promise<Paginated<InvoiceListRow>> {
  const user = await requireRoles([Role.SM, Role.OPS_HEAD, Role.FINANCE]);
  return getInvoicesQuery({
    ...filters,
    scopeWarehouseIds:
      filters.scopeWarehouseIds ?? assignedWarehouseIds(user),
    uploadedById: user.role === Role.SM ? user.id : filters.uploadedById,
  });
}

export async function getInvoiceById(id: string): Promise<InvoiceDetail | null> {
  const user = await requireRoles([Role.SM, Role.OPS_HEAD, Role.FINANCE]);
  const access = await assertSessionInvoiceAccess(user, id);
  if (!access.ok) {
    return null;
  }
  return getInvoiceByIdQuery(id);
}

export async function getInvoiceFilterOptions() {
  await requireRoles([Role.SM, Role.OPS_HEAD, Role.FINANCE]);
  return getInvoiceFilterOptionsQuery();
}

export async function getPOsForInvoice(): Promise<POForInvoiceOption[]> {
  const user = await requireRoles([Role.SM, Role.OPS_HEAD]);
  return getPOsForInvoiceQuery(assignedWarehouseIds(user));
}

export async function searchPOsForInvoice(
  q: string,
): Promise<Pick<POForInvoiceOption, "id" | "label" | "vendorName">[]> {
  const user = await requireRoles([Role.SM, Role.OPS_HEAD]);
  return searchPOsForInvoiceQuery(q, 20, assignedWarehouseIds(user));
}

export async function getPOForInvoice(poId: string): Promise<POForInvoiceOption | null> {
  const user = await requireRoles([Role.SM, Role.OPS_HEAD]);
  const access = await assertSessionPurchaseOrderAccess(user, poId);
  if (!access.ok) {
    return null;
  }
  return getPOForInvoiceByIdQuery(poId);
}

export async function getGRNsForPO(poId: string) {
  const user = await requireRoles([Role.SM, Role.OPS_HEAD]);
  const access = await assertSessionPurchaseOrderAccess(user, poId);
  if (!access.ok) {
    return [];
  }
  return getGRNsForPOQuery(poId);
}

export async function createInvoice(
  formData: FormData,
): Promise<{ ok: boolean; invoiceId?: string; message?: string }> {
  const user = await requireRoles([Role.SM, Role.OPS_HEAD]);

  const poId = String(formData.get("poId") ?? "").trim();
  if (!poId) {
    return { ok: false, message: "Purchase order is required." };
  }

  const poAccess = await assertSessionPurchaseOrderAccess(user, poId);
  if (!poAccess.ok) {
    return { ok: false, message: poAccess.message };
  }

  const grnIds = formData
    .getAll("grnId")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const invoiceNumber = String(formData.get("invoiceNumber") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const invoiceDateRaw = String(formData.get("invoiceDate") ?? "").trim();
  const file = formData.get("file");

  if (!poId || grnIds.length === 0) {
    return { ok: false, message: "Select a PO and at least one GRN." };
  }
  if (!invoiceNumber) {
    return { ok: false, message: "Invoice number is required." };
  }
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Enter a valid invoice amount." };
  }
  const invoiceDate = new Date(invoiceDateRaw);
  if (Number.isNaN(invoiceDate.getTime())) {
    return { ok: false, message: "Invalid invoice date." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Invoice file is required." };
  }

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: {
      lineItems: {
        include: {
          catalogItem: { select: { name: true } },
          goodsReceiptLineItems: {
            where: { grnId: { in: grnIds } },
            select: { acceptedQty: true },
          },
        },
      },
      lines: {
        include: {
          goodsReceiptLines: {
            where: { grnId: { in: grnIds } },
            select: { acceptedQty: true },
          },
        },
      },
      grns: {
        where: { id: { in: grnIds } },
        include: { invoiceLinks: true },
      },
    },
  });

  if (!po) {
    return { ok: false, message: "Purchase order not found." };
  }
  if (po.grns.length !== grnIds.length) {
    return { ok: false, message: "One or more GRNs are invalid for this PO." };
  }
  if (po.grns.some((g) => g.invoiceLinks.length > 0)) {
    return { ok: false, message: "A selected GRN is already linked to an invoice." };
  }
  if (po.grns.some((g) => g.acceptedQty <= 0)) {
    return { ok: false, message: "Selected GRNs must have accepted quantity." };
  }

  const acceptedQty = po.grns.reduce((s, g) => s + g.acceptedQty, 0);

  let expectedAmount: number | null = null;
  if (po.lineItems.length > 0) {
    expectedAmount = po.lineItems.reduce((sum, line) => {
      const lineAccepted = line.goodsReceiptLineItems.reduce(
        (s, grl) => s + grl.acceptedQty,
        0,
      );
      return sum + lineAccepted * Number(line.unitPrice);
    }, 0);
  } else if (po.lines.length > 0) {
    expectedAmount = po.lines.reduce((sum, line) => {
      const lineAccepted = line.goodsReceiptLines.reduce((s, grl) => s + grl.acceptedQty, 0);
      return sum + lineAccepted * Number(line.unitPrice);
    }, 0);
  } else if (po.unitPrice != null) {
    expectedAmount = acceptedQty * Number(po.unitPrice);
  }

  const match = computeInvoiceMatchFromExpected(expectedAmount, amount);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const storagePath = `${poId}/${Date.now()}-${safeName}`;

  const upload = await uploadStorageObject(
    STORAGE_BUCKETS.invoices,
    storagePath,
    bytes,
    file.type || "application/octet-stream",
  );
  if (!upload.ok) {
    return { ok: false, message: upload.message };
  }

  try {
    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          poId,
          invoiceNumber,
          amount,
          invoiceDate,
          fileUrl: storagePath,
          uploadedById: user.id,
          matchStatus: match.matchStatus,
          expectedAmount: match.expectedAmount,
          paymentStatus: "UNPAID",
        },
      });

      await tx.invoiceGRNLink.createMany({
        data: grnIds.map((grnId) => ({ invoiceId: created.id, grnId })),
      });

      await applyPOClosureInTransaction(tx, poId);
      return created;
    }, PO_CLOSURE_TX_OPTS);

    revalidateInvoiceMutation(poId);

    return { ok: true, invoiceId: invoice.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create invoice.";
    if (msg.includes("Unique constraint")) {
      return { ok: false, message: "An invoice with this number already exists for this PO." };
    }
    return { ok: false, message: msg };
  }
}

export async function overrideInvoiceMatch(
  invoiceId: string,
  reason: string,
): Promise<MutationResult> {
  const user = await requireRoles([Role.OPS_HEAD]);
  const trimmed = reason.trim();
  if (!trimmed) {
    return { ok: false, message: "Override reason is required." };
  }

  const access = await assertSessionInvoiceAccess(user, invoiceId);
  if (!access.ok) {
    return { ok: false, message: access.message };
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { poId: true, matchStatus: true },
  });
  if (!invoice) {
    return { ok: false, message: "Invoice not found." };
  }
  if (invoice.matchStatus !== "MISMATCH") {
    return { ok: false, message: "Only mismatched invoices can be overridden." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        matchStatus: "OVERRIDE_ACCEPTED",
        overrideById: user.id,
        overrideReason: trimmed,
      },
    });
    await applyPOClosureInTransaction(tx, invoice.poId);
  }, PO_CLOSURE_TX_OPTS);

  revalidateInvoiceMutation(invoice.poId);

  return { ok: true };
}

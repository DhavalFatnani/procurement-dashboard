"use server";

import { Role } from "@/lib/prisma-enums";

import type { MutationResult } from "@/lib/action-result";
import { countOpenGrnExceptionsOnPo } from "@/lib/po-line-effective";
import { computeInvoiceMatchFromExpected } from "@/lib/invoiceMatch";
import { applyGstToSubtotal } from "@/lib/po-gst";
import { PO_CLOSURE_TX_OPTS, schedulePOClosure } from "@/lib/poAutoClose";
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
import { ALL_DASHBOARD_ROLES, OPS_OR_ADMIN_ROLES, SM_OPS_OR_ADMIN_ROLES } from "@/lib/admin-access";
import { STORAGE_BUCKETS } from "@/lib/storage";
import { uploadStorageObject } from "@/lib/upload-storage";
import { prisma } from "@/lib/prisma";
import {
  assertSessionInvoiceAccess,
  assertSessionPurchaseOrderAccess,
} from "@/lib/warehouse-access";
import { scopeWarehouseIdsForUser } from "@/lib/warehouse-scope";

export async function getInvoices(
  filters: InvoiceFilters,
): Promise<Paginated<InvoiceListRow>> {
  const user = await requireRoles([...ALL_DASHBOARD_ROLES]);
  return getInvoicesQuery({
    ...filters,
    scopeWarehouseIds:
      filters.scopeWarehouseIds ?? scopeWarehouseIdsForUser(user),
    uploadedById: user.role === Role.SM ? user.id : filters.uploadedById,
  });
}

export async function getInvoiceById(id: string): Promise<InvoiceDetail | null> {
  const user = await requireRoles([...ALL_DASHBOARD_ROLES]);
  const access = await assertSessionInvoiceAccess(user, id);
  if (!access.ok) {
    return null;
  }
  return getInvoiceByIdQuery(id);
}

export async function getInvoiceFilterOptions() {
  await requireRoles([...ALL_DASHBOARD_ROLES]);
  return getInvoiceFilterOptionsQuery();
}

export async function getPOsForInvoice(): Promise<
  Pick<POForInvoiceOption, "id" | "label" | "vendorName">[]
> {
  const user = await requireRoles([...SM_OPS_OR_ADMIN_ROLES]);
  return getPOsForInvoiceQuery(scopeWarehouseIdsForUser(user));
}

export async function searchPOsForInvoice(
  q: string,
): Promise<Pick<POForInvoiceOption, "id" | "label" | "vendorName">[]> {
  const user = await requireRoles([...SM_OPS_OR_ADMIN_ROLES]);
  return searchPOsForInvoiceQuery(q, 20, scopeWarehouseIdsForUser(user));
}

export async function getPOForInvoice(poId: string): Promise<POForInvoiceOption | null> {
  const user = await requireRoles([...SM_OPS_OR_ADMIN_ROLES]);
  const access = await assertSessionPurchaseOrderAccess(user, poId);
  if (!access.ok) {
    return null;
  }
  return getPOForInvoiceByIdQuery(poId);
}

export async function getGRNsForPO(poId: string) {
  const user = await requireRoles([...SM_OPS_OR_ADMIN_ROLES]);
  const access = await assertSessionPurchaseOrderAccess(user, poId);
  if (!access.ok) {
    return [];
  }
  return getGRNsForPOQuery(poId);
}

export async function createInvoice(
  formData: FormData,
): Promise<{ ok: boolean; invoiceId?: string; message?: string }> {
  const user = await requireRoles([...SM_OPS_OR_ADMIN_ROLES]);

  const poId = String(formData.get("poId") ?? "").trim();
  if (!poId) {
    return { ok: false, message: "Purchase order is required." };
  }

  const poAccess = await assertSessionPurchaseOrderAccess(user, poId);
  if (!poAccess.ok) {
    return { ok: false, message: poAccess.message };
  }

  const openDisputes = await countOpenGrnExceptionsOnPo(prisma, poId);
  if (openDisputes > 0) {
    return {
      ok: false,
      message:
        "Resolve all GRN disputes on this purchase order before uploading an invoice.",
    };
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

  let subtotal: number | null = null;
  if (po.lineItems.length > 0) {
    subtotal = po.lineItems.reduce((sum, line) => {
      const lineAccepted = line.goodsReceiptLineItems.reduce(
        (s, grl) => s + grl.acceptedQty,
        0,
      );
      return sum + lineAccepted * Number(line.unitPrice);
    }, 0);
  } else if (po.lines.length > 0) {
    subtotal = po.lines.reduce((sum, line) => {
      const lineAccepted = line.goodsReceiptLines.reduce((s, grl) => s + grl.acceptedQty, 0);
      return sum + lineAccepted * Number(line.unitPrice);
    }, 0);
  } else if (po.unitPrice != null) {
    subtotal = acceptedQty * Number(po.unitPrice);
  }

  const expectedAmount =
    subtotal == null
      ? null
      : applyGstToSubtotal(
          subtotal,
          po.gstApplicable,
          po.gstRatePercent != null ? Number(po.gstRatePercent) : null,
        ).total;

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

      return created;
    }, PO_CLOSURE_TX_OPTS);

    revalidateInvoiceMutation(poId);
    schedulePOClosure(poId);

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
  const user = await requireRoles([...OPS_OR_ADMIN_ROLES]);
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
  }, PO_CLOSURE_TX_OPTS);

  revalidateInvoiceMutation(invoice.poId);
  schedulePOClosure(invoice.poId);

  return { ok: true };
}

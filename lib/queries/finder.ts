import { Role } from "@/lib/prisma-enums";

import { FINANCE_ROUTES } from "@/lib/finance-routes";
import { prisma } from "@/lib/prisma";

export type FinderEntityKind =
  | "purchaseRequest"
  | "purchaseOrder"
  | "vendor"
  | "invoice"
  | "payment";

export type FinderResult = {
  id: string;
  kind: FinderEntityKind;
  /** Ref label (e.g. PR-XXXX, PO-XXXX, INV-12345). */
  refLabel: string;
  title: string;
  subtitle: string;
  href: string;
};

const REF_PREFIX_RE = /^(PR|PO|INV|GRN)-?([0-9a-z-]*)$/i;

function looksLikeRef(query: string): { prefix: string; rest: string } | null {
  const match = REF_PREFIX_RE.exec(query.trim());
  if (!match) {
    return null;
  }
  return { prefix: match[1]!.toUpperCase(), rest: match[2] ?? "" };
}

async function findPurchaseRequests(query: string, limit: number): Promise<FinderResult[]> {
  const rows = await prisma.purchaseRequest.findMany({
    where: { id: { startsWith: `PR-${query.replace(/^PR-?/i, "")}`, mode: "insensitive" } },
    select: {
      id: true,
      vendor: { select: { businessName: true } },
      lines: {
        orderBy: { lineNumber: "asc" },
        select: { subcategory: { select: { name: true } }, quantity: true },
        take: 1,
      },
    },
    take: limit,
  });
  return rows.map((pr) => ({
    id: pr.id,
    kind: "purchaseRequest",
    refLabel: pr.id,
    title: pr.lines[0]
      ? `${pr.lines[0].subcategory.name} × ${pr.lines[0].quantity}`
      : "Purchase request",
    subtitle: pr.vendor?.businessName ?? "—",
    href: `/purchase-requests/${pr.id}`,
  }));
}

async function findPurchaseOrders(query: string, limit: number): Promise<FinderResult[]> {
  const rows = await prisma.purchaseOrder.findMany({
    where: { id: { startsWith: `PO-${query.replace(/^PO-?/i, "")}`, mode: "insensitive" } },
    select: {
      id: true,
      status: true,
      vendor: { select: { businessName: true } },
    },
    take: limit,
  });
  return rows.map((po) => ({
    id: po.id,
    kind: "purchaseOrder",
    refLabel: po.id,
    title: po.vendor.businessName,
    subtitle: po.status.replaceAll("_", " "),
    href: `/purchase-orders/${po.id}`,
  }));
}

async function findVendors(query: string, limit: number, role: Role): Promise<FinderResult[]> {
  if (role === Role.FINANCE) {
    return [];
  }
  const rows = await prisma.vendor.findMany({
    where: { businessName: { contains: query, mode: "insensitive" } },
    select: { id: true, businessName: true, status: true, ifsc: true },
    take: limit,
    orderBy: { businessName: "asc" },
  });
  return rows.map((v) => ({
    id: v.id,
    kind: "vendor",
    refLabel: v.id.slice(-6).toUpperCase(),
    title: v.businessName,
    subtitle: `${v.status.toLowerCase()} · ${v.ifsc}`,
    href: `/vendors/${v.id}`,
  }));
}

async function findInvoices(
  query: string,
  limit: number,
  role: Role,
): Promise<FinderResult[]> {
  const rows = await prisma.invoice.findMany({
    where: { invoiceNumber: { contains: query, mode: "insensitive" } },
    select: {
      id: true,
      invoiceNumber: true,
      poId: true,
      purchaseOrder: { select: { vendor: { select: { businessName: true } } } },
    },
    take: limit,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((inv) => ({
    id: inv.id,
    kind: "invoice",
    refLabel: `INV-${inv.invoiceNumber}`,
    title: inv.purchaseOrder.vendor.businessName,
    subtitle: `Invoice ${inv.invoiceNumber}`,
    href:
      role === Role.FINANCE
        ? FINANCE_ROUTES.invoiceDetail(inv.id)
        : `/purchase-orders/${inv.poId}?tab=invoices`,
  }));
}

async function findPaymentsByTransactionRef(
  query: string,
  limit: number,
): Promise<FinderResult[]> {
  const rows = await prisma.payment.findMany({
    where: {
      transactionRef: { contains: query, mode: "insensitive" },
      amount: { not: null },
    },
    select: {
      id: true,
      transactionRef: true,
      amount: true,
      method: true,
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          purchaseOrder: { select: { vendor: { select: { businessName: true } } } },
        },
      },
    },
    take: limit,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((p) => ({
    id: p.id,
    kind: "payment",
    refLabel: p.transactionRef ?? p.id.slice(-8).toUpperCase(),
    title: p.invoice.purchaseOrder.vendor.businessName,
    subtitle: `Cash ${p.method ?? "payment"} · ${formatInrAmount(p.amount)} · INV ${p.invoice.invoiceNumber}`,
    href: FINANCE_ROUTES.cashPaymentDetail(p.id),
  }));
}

function formatInrAmount(amount: { toString(): string } | null): string {
  if (amount == null) return "—";
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

export async function findEntities({
  query,
  role,
  limit = 5,
}: {
  query: string;
  role: Role;
  limit?: number;
}): Promise<FinderResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const ref = looksLikeRef(trimmed);

  if (ref) {
    const restQuery = ref.rest;
    switch (ref.prefix) {
      case "PR":
        if (role === Role.FINANCE) return [];
        return findPurchaseRequests(restQuery, limit);
      case "PO":
        return findPurchaseOrders(restQuery, limit);
      case "INV":
        return findInvoices(restQuery, limit, role);
      case "GRN":
        return [];
      default:
        break;
    }
  }

  const searches: Promise<FinderResult[]>[] = [
    findVendors(trimmed, limit, role),
    findInvoices(trimmed, limit, role),
  ];
  if (role === Role.FINANCE) {
    searches.push(findPaymentsByTransactionRef(trimmed, limit));
  }

  const results = await Promise.all(searches);
  return results.flat().slice(0, limit * 2);
}

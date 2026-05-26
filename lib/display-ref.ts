import { formatDateMedium } from "@/lib/format-datetime";

const PROCUREMENT_DOC = /^(PR|PO)-([0-9a-f-]+)$/i;

/** Short procurement document ref (PR-550E8400) from PR-{uuid} / PO-{uuid}. */
export function formatProcurementRef(id: string): string {
  const match = PROCUREMENT_DOC.exec(id.trim());
  if (!match) {
    return formatShortRef(id);
  }
  const prefix = match[1]!.toUpperCase();
  const compact = match[2]!.replace(/-/g, "");
  return `${prefix}-${compact.slice(0, 8).toUpperCase()}`;
}

/** Non–PR/PO internal ids (cuid, etc.) — never show full value in UI. */
export function formatShortRef(id: string): string {
  const compact = id.replace(/-/g, "");
  if (compact.length <= 10) {
    return compact.toUpperCase();
  }
  return compact.slice(-8).toUpperCase();
}

export function procurementRefPath(id: string): string | null {
  if (id.startsWith("PR-")) {
    return `/purchase-requests/${id}`;
  }
  if (id.startsWith("PO-")) {
    return `/purchase-orders/${id}`;
  }
  return null;
}

export function formatGrnReceiptLabel(
  poId: string,
  receivedAt: string,
  vendorName?: string,
): string {
  const po = formatProcurementRef(poId);
  const date = formatDateMedium(receivedAt);
  return vendorName ? `${vendorName} · ${po} · ${date}` : `Receipt · ${po} · ${date}`;
}

export function formatSerialBatchLabel(input: {
  seriesName: string;
  rangeStart: string;
  rangeEnd: string;
  quantity?: number;
}): string {
  const range = `${input.rangeStart}–${input.rangeEnd}`;
  if (input.quantity != null) {
    return `${input.seriesName} · ${range} (${input.quantity})`;
  }
  return `${input.seriesName} · ${range}`;
}

export function formatPrPageTitle(input: {
  id: string;
  categoryName: string;
  subcategoryName: string;
}): string {
  return `${input.categoryName} · ${input.subcategoryName}`;
}

export function formatPoPageTitle(input: {
  id: string;
  vendorName: string;
}): string {
  return `${formatProcurementRef(input.id)} · ${input.vendorName}`;
}

export function formatGrnReceiptsSummary(
  receipts: { receivedAt: string }[],
): string {
  if (receipts.length === 0) {
    return "—";
  }
  if (receipts.length === 1) {
    return formatDateMedium(receipts[0]!.receivedAt);
  }
  return `${receipts.length} receipts`;
}

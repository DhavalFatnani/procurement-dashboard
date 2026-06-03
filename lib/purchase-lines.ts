import { SerialSeries, type GRNExceptionType } from "@prisma/client";

export type PRLineItemRow = {
  id: string;
  lineItemNumber: number;
  catalogItemId: string;
  itemName: string;
  sku: string | null;
  unit: string;
  catalogStatus: string;
  quantity: number;
};

export type PRLineRow = {
  id: string;
  lineNumber: number;
  categoryId: string;
  categoryName: string;
  subcategoryId: string;
  subcategoryName: string;
  /** Sum of item quantities (vendor) or line qty (internal print). */
  quantity: number;
  notes: string | null;
  items: PRLineItemRow[];
};

export type POLineRow = {
  id: string;
  prLineId: string;
  lineNumber: number;
  categoryId: string;
  categoryName: string;
  subcategoryId: string;
  subcategoryName: string;
  orderedQty: number;
  unitPrice: string;
  receivedQty: number;
};

export type GRNLineInput = {
  poLineId: string;
  receivedQty: number;
};

export type GRNLineItemExceptionInput = {
  exceptionType: GRNExceptionType;
  exceptionQty: number;
  note: string;
};

export type GRNLineItemInput = {
  poLineItemId: string;
  receivedQty: number;
  exception?: GRNLineItemExceptionInput;
};

export type POLineItemRow = {
  id: string;
  prLineItemId: string;
  lineNumber: number;
  lineItemNumber: number;
  categoryId: string;
  categoryName: string;
  subcategoryId: string;
  subcategoryName: string;
  itemName: string;
  sku: string | null;
  unit: string;
  orderedQty: number;
  unitPrice: string;
  receivedQty: number;
};

export const MAX_PR_LINES = 20;

export function isLockTagsCategoryName(name: string): boolean {
  return name === "Lock Tags";
}

export function sumLineQuantities(
  lines: { quantity: number; items?: { quantity: number }[] }[],
): number {
  return lines.reduce((sum, line) => {
    if (line.items && line.items.length > 0) {
      return sum + line.items.reduce((s, i) => s + i.quantity, 0);
    }
    return sum + line.quantity;
  }, 0);
}

export function sumItemQuantities(items: { quantity: number }[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function sumOrderedQty(lines: { orderedQty: number }[]): number {
  return lines.reduce((sum, line) => sum + line.orderedQty, 0);
}

export function sumLineValue(
  lines: { orderedQty?: number; acceptedQty?: number; unitPrice: number | string }[],
  qtyKey: "orderedQty" | "acceptedQty",
): number {
  return lines.reduce((sum, line) => {
    const qty = line[qtyKey] ?? 0;
    const price = typeof line.unitPrice === "string" ? Number(line.unitPrice) : line.unitPrice;
    return sum + qty * price;
  }, 0);
}

function catalogItemsOnLine(line: {
  items?: { quantity: number }[];
  catalogItemCount?: number;
}): number {
  if (line.items && line.items.length > 0) {
    return line.items.length;
  }
  if (line.catalogItemCount !== undefined) {
    return line.catalogItemCount;
  }
  return 0;
}

/** e.g. "3 lines · 12 items" or single subcategory name */
export function formatLineSummary(
  lines: {
    subcategoryName: string;
    categoryName?: string;
    items?: { quantity: number }[];
    catalogItemCount?: number;
  }[],
): {
  lineCount: number;
  itemCount: number;
  summary: string;
  primarySubcategory: string;
  totalQty: number;
} {
  if (lines.length === 0) {
    return {
      lineCount: 0,
      itemCount: 0,
      summary: "—",
      primarySubcategory: "—",
      totalQty: 0,
    };
  }

  const sorted = [...lines];
  const primary = sorted[0]!.subcategoryName;
  const lineCount = sorted.length;
  const itemCount = sorted.reduce((sum, line) => sum + catalogItemsOnLine(line), 0);

  if (lineCount === 1) {
    const catalogItems = catalogItemsOnLine(sorted[0]!);
    const itemSuffix =
      catalogItems > 1 ? ` · ${catalogItems} items` : "";
    return {
      lineCount: 1,
      itemCount: catalogItems,
      summary: `${primary}${itemSuffix}`,
      primarySubcategory: primary,
      totalQty: 0,
    };
  }

  const categoryLabel = sorted[0]!.categoryName ?? sorted[0]!.subcategoryName;
  const counts =
    itemCount > 0
      ? `${lineCount} lines · ${itemCount} items`
      : `${lineCount} lines`;
  return {
    lineCount,
    itemCount,
    summary: `${counts} · ${categoryLabel} + ${lineCount - 1} more`,
    primarySubcategory: primary,
    totalQty: 0,
  };
}

export function lockTagsOrderedQty(
  lines: { categoryName: string; orderedQty: number }[],
): number {
  return lines
    .filter((line) => isLockTagsCategoryName(line.categoryName))
    .reduce((sum, line) => sum + line.orderedQty, 0);
}

export function hasLockTagsLines(
  lines: { categoryName: string }[],
): boolean {
  return lines.some((line) => isLockTagsCategoryName(line.categoryName));
}

export const LOCK_TAGS_SERIES = SerialSeries.LOCK_TAGS;

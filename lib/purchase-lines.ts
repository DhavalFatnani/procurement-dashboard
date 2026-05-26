import { SerialSeries } from "@prisma/client";

export type PRLineRow = {
  id: string;
  lineNumber: number;
  categoryId: string;
  categoryName: string;
  subcategoryId: string;
  subcategoryName: string;
  quantity: number;
  notes: string | null;
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

export const MAX_PR_LINES = 20;

export function isLockTagsCategoryName(name: string): boolean {
  return name === "Lock Tags";
}

export function sumLineQuantities(lines: { quantity: number }[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
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

/** e.g. "3 items · Lock Tags + 2 more" or single subcategory name */
export function formatLineSummary(
  lines: { subcategoryName: string; categoryName?: string }[],
): { lineCount: number; summary: string; primarySubcategory: string; totalQty: number } {
  if (lines.length === 0) {
    return { lineCount: 0, summary: "—", primarySubcategory: "—", totalQty: 0 };
  }

  const sorted = [...lines];
  const primary = sorted[0]!.subcategoryName;
  const lineCount = sorted.length;

  if (lineCount === 1) {
    return {
      lineCount: 1,
      summary: primary,
      primarySubcategory: primary,
      totalQty: 0,
    };
  }

  const categoryLabel = sorted[0]!.categoryName ?? sorted[0]!.subcategoryName;
  return {
    lineCount,
    summary: `${lineCount} items · ${categoryLabel} + ${lineCount - 1} more`,
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

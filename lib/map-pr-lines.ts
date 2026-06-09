import type { PRLineItemRow, PRLineRow } from "@/lib/purchase-lines";

type DbLine = {
  id: string;
  lineNumber: number;
  categoryId: string;
  subcategoryId: string;
  quantity: number | null;
  notes: string | null;
  category: { name: string; billingGranularity: import("@/lib/prisma-enums").CategoryBillingGranularity };
  subcategory: { name: string };
  items?: {
    id: string;
    lineItemNumber: number;
    catalogItemId: string;
    quantity: number;
    catalogItem: {
      name: string;
      sku: string | null;
      unit: string;
      status: string;
    };
  }[];
};

export function mapPrLinesFromDb(lines: DbLine[]): PRLineRow[] {
  return lines.map((line) => {
    const items: PRLineItemRow[] = (line.items ?? []).map((item) => ({
      id: item.id,
      lineItemNumber: item.lineItemNumber,
      catalogItemId: item.catalogItemId,
      itemName: item.catalogItem.name,
      sku: item.catalogItem.sku,
      unit: item.catalogItem.unit,
      catalogStatus: item.catalogItem.status,
      quantity: item.quantity,
    }));
    const quantity =
      items.length > 0
        ? items.reduce((sum, i) => sum + i.quantity, 0)
        : (line.quantity ?? 0);

    return {
      id: line.id,
      lineNumber: line.lineNumber,
      categoryId: line.categoryId,
      categoryName: line.category.name,
      billingGranularity: line.category.billingGranularity,
      subcategoryId: line.subcategoryId,
      subcategoryName: line.subcategory.name,
      quantity,
      notes: line.notes,
      items,
    };
  });
}

/** Lighter line select for awaiting-PO panel (no catalog status). */
export const prLinesAwaitingPoSelect = {
  orderBy: { lineNumber: "asc" as const },
  select: {
    id: true,
    lineNumber: true,
    categoryId: true,
    subcategoryId: true,
    quantity: true,
    notes: true,
    category: { select: { name: true, billingGranularity: true } },
    subcategory: { select: { name: true } },
    items: {
      orderBy: { lineItemNumber: "asc" as const },
      select: {
        id: true,
        lineItemNumber: true,
        catalogItemId: true,
        quantity: true,
        catalogItem: {
          select: { name: true, sku: true, unit: true, status: true },
        },
        poLineItem: { select: { poId: true } },
      },
    },
  },
} as const;

export const prLinesInclude = {
  orderBy: { lineNumber: "asc" as const },
  include: {
    category: { select: { name: true, billingGranularity: true } },
    subcategory: { select: { name: true } },
    items: {
      orderBy: { lineItemNumber: "asc" as const },
      include: {
        catalogItem: {
          select: { name: true, sku: true, unit: true, status: true },
        },
        poLineItem: { select: { id: true } },
      },
    },
  },
};

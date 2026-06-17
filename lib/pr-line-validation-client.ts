import {
  categoryById,
  usesCatalogItemAtomicity,
  usesSubcategoryAtomicity,
} from "@/lib/catalog-atomicity";
import type { CategoryBillingGranularity } from "@/lib/prisma-enums";

export type PRLineFieldError = {
  lineKey: string;
  itemKey?: string;
  field: "category" | "subcategory" | "quantity" | "item";
  message: string;
};

export type PRLineDraftForValidation = {
  key: string;
  categoryId: string;
  subcategoryId: string;
  quantity: number;
  items: {
    key: string;
    catalogItemId?: string;
    proposedName?: string;
    quantity: number;
  }[];
};

export function prLineFieldId(
  lineKey: string,
  field: PRLineFieldError["field"],
  itemKey?: string,
): string {
  if (itemKey) {
    if (field === "item") {
      return `line-${lineKey}-item-${itemKey}`;
    }
    if (field === "quantity") {
      return `line-${lineKey}-item-${itemKey}-quantity`;
    }
  }
  return `line-${lineKey}-${field}`;
}

export function fieldErrorIds(errors: PRLineFieldError[]): Set<string> {
  return new Set(errors.map((e) => prLineFieldId(e.lineKey, e.field, e.itemKey)));
}

export function getFieldErrorMessage(
  errors: PRLineFieldError[],
  lineKey: string,
  field: PRLineFieldError["field"],
  itemKey?: string,
): string | undefined {
  return errors.find(
    (e) => e.lineKey === lineKey && e.field === field && e.itemKey === itemKey,
  )?.message;
}

export function validateVendorLineDrafts(
  lines: PRLineDraftForValidation[],
  categories: { id: string; billingGranularity: CategoryBillingGranularity }[],
): { ok: true } | { ok: false; errors: PRLineFieldError[]; firstFieldId: string } {
  const errors: PRLineFieldError[] = [];

  if (lines.length < 1) {
    return {
      ok: false,
      errors: [
        {
          lineKey: "",
          field: "category",
          message: "Add at least one line item.",
        },
      ],
      firstFieldId: "",
    };
  }

  for (const line of lines) {
    const lineErrors = validateSingleVendorLine(line, categories);
    errors.push(...lineErrors);
  }

  if (errors.length === 0) {
    return { ok: true };
  }

  const first = errors[0]!;
  return {
    ok: false,
    errors,
    firstFieldId: prLineFieldId(first.lineKey, first.field, first.itemKey),
  };
}

function validateSingleVendorLine(
  line: PRLineDraftForValidation,
  categories: { id: string; billingGranularity: CategoryBillingGranularity }[],
): PRLineFieldError[] {
  const errors: PRLineFieldError[] = [];
  const { key: lineKey } = line;

  if (!line.categoryId.trim()) {
    errors.push({
      lineKey,
      field: "category",
      message: "Select a category.",
    });
  }

  if (!line.subcategoryId.trim()) {
    errors.push({
      lineKey,
      field: "subcategory",
      message: "Select a subcategory.",
    });
  }

  const category = line.categoryId.trim()
    ? categoryById(line.categoryId, categories)
    : undefined;

  if (!category) {
    return errors;
  }

  if (usesSubcategoryAtomicity(category)) {
    if (line.quantity < 1) {
      errors.push({
        lineKey,
        field: "quantity",
        message: "Quantity must be at least 1.",
      });
    }
    return errors;
  }

  if (usesCatalogItemAtomicity(category)) {
    if (line.items.length < 1) {
      errors.push({
        lineKey,
        field: "item",
        message: "Each warehouse maintenance line must include at least one catalog item.",
      });
      return errors;
    }

    for (const item of line.items) {
      const hasCatalog = Boolean(item.catalogItemId?.trim());
      const hasProposal = Boolean(item.proposedName?.trim());

      if (!hasCatalog && !hasProposal) {
        errors.push({
          lineKey,
          itemKey: item.key,
          field: "item",
          message: "Select a catalog item or propose a new name.",
        });
      }

      if (item.quantity < 1) {
        errors.push({
          lineKey,
          itemKey: item.key,
          field: "quantity",
          message: "Each item quantity must be at least 1.",
        });
      }
    }
  }

  return errors;
}

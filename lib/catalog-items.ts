/** Normalize catalog item names for uniqueness checks. */
export function normalizeCatalogItemName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export const MAX_ITEMS_PER_PR_LINE = 50;
export const MAX_ITEMS_PER_PR = 200;

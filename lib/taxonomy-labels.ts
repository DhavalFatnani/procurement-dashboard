import { CategoryBillingGranularity } from "@/lib/prisma-enums";

export const BILLING_GRANULARITY_LABEL: Record<CategoryBillingGranularity, string> = {
  [CategoryBillingGranularity.CATALOG_ITEM]: "Catalog items",
  [CategoryBillingGranularity.SUBCATEGORY]: "Subcategory quantity",
};

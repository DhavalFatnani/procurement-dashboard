import { unstable_cache } from "next/cache";
import { CatalogItemStatus, Role, type SerialSeries } from "@/lib/prisma-enums";

import { prisma } from "@/lib/prisma";

/** JSON-safe series config for `unstable_cache` (Prisma `BigInt` is not serializable). */
export type CachedSeriesConfig = {
  id: string;
  series: SerialSeries;
  inactivityThresholdDays: number;
  ceilingNumber: string;
  ceilingAlertPct: number;
  configuredById: string;
  configuredAt: string;
  updatedAt: string;
};

export const getCachedCategories = unstable_cache(
  async () =>
    prisma.category.findMany({
      include: { subcategories: true },
      orderBy: { name: "asc" },
    }),
  ["categories-with-subcategories"],
  { revalidate: 3600, tags: ["categories"] },
);

export const getCachedWarehouses = unstable_cache(
  async () => prisma.warehouse.findMany({ orderBy: { name: "asc" } }),
  ["warehouses"],
  { revalidate: 3600, tags: ["warehouses"] },
);

export const getCachedSeriesConfigs = unstable_cache(
  async (): Promise<CachedSeriesConfig[]> => {
    const rows = await prisma.seriesConfig.findMany();
    return rows.map((c) => ({
      id: c.id,
      series: c.series,
      inactivityThresholdDays: c.inactivityThresholdDays,
      ceilingNumber: c.ceilingNumber.toString(),
      ceilingAlertPct: c.ceilingAlertPct,
      configuredById: c.configuredById,
      configuredAt: c.configuredAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  },
  ["series-configs"],
  { revalidate: 300, tags: ["series-configs"] },
);

export const getCachedCreators = unstable_cache(
  async () =>
    prisma.user.findMany({
      where: { role: { in: [Role.SM, Role.OPS_HEAD] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ["filter-creators"],
  { revalidate: 3600, tags: ["filter-creators"] },
);

/** Active vendors for filter dropdowns (PO, invoices, payments, GRN). Invalidated
 * via the "vendor-options" tag on vendor create/update/status changes. */
export const getCachedActiveCatalogItems = unstable_cache(
  async () =>
    prisma.catalogItem.findMany({
      where: { status: CatalogItemStatus.ACTIVE },
      orderBy: [{ subcategoryId: "asc" }, { name: "asc" }],
      select: {
        id: true,
        subcategoryId: true,
        name: true,
        sku: true,
        unit: true,
      },
    }),
  ["active-catalog-items"],
  { revalidate: 300, tags: ["catalog-items"] },
);

export const getCachedActiveVendorOptions = unstable_cache(
  async () =>
    prisma.vendor.findMany({
      where: { status: "ACTIVE" },
      orderBy: { businessName: "asc" },
      select: { id: true, businessName: true, gst: true },
    }),
  ["active-vendor-options"],
  { revalidate: 3600, tags: ["vendor-options"] },
);

import { unstable_cache } from "next/cache";
import { CatalogItemStatus, Role } from "@/lib/prisma-enums";

import { prisma } from "@/lib/prisma";
import { buildSeriesRegistry, type SeriesRegistry } from "@/lib/series-registry";

/** JSON-safe series definition for `unstable_cache` (Prisma `BigInt` is not serializable). */
export type CachedSeriesDefinition = {
  id: string;
  code: string;
  displayName: string;
  prefixPattern: string;
  rangeStart: string;
  inactivityThresholdDays: number;
  ceilingNumber: string;
  ceilingAlertPct: number;
  sortOrder: number;
  isActive: boolean;
  configuredById: string;
  configuredAt: string;
  updatedAt: string;
};

/** @deprecated Use CachedSeriesDefinition */
export type CachedSeriesConfig = CachedSeriesDefinition;

export const getCachedCategories = unstable_cache(
  async () =>
    prisma.category.findMany({
      where: { status: "ACTIVE" },
      include: {
        subcategories: {
          where: { status: "ACTIVE" },
          orderBy: { name: "asc" },
        },
      },
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

export const getCachedSeriesDefinitions = unstable_cache(
  async (): Promise<CachedSeriesDefinition[]> => {
    const rows = await prisma.seriesConfig.findMany({
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });
    return rows.map((c) => ({
      id: c.id,
      code: c.code,
      displayName: c.displayName,
      prefixPattern: c.prefixPattern,
      rangeStart: c.rangeStart.toString(),
      inactivityThresholdDays: c.inactivityThresholdDays,
      ceilingNumber: c.ceilingNumber.toString(),
      ceilingAlertPct: c.ceilingAlertPct,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      configuredById: c.configuredById,
      configuredAt: c.configuredAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  },
  ["series-configs"],
  { revalidate: 300, tags: ["series-configs"] },
);

/** @deprecated Use getCachedSeriesDefinitions */
export const getCachedSeriesConfigs = getCachedSeriesDefinitions;

export async function getCachedSeriesRegistry(): Promise<SeriesRegistry> {
  return buildSeriesRegistry(await getCachedSeriesDefinitions());
}

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

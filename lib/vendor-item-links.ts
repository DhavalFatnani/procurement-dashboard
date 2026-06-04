import { VendorItemPriceSource, type Prisma } from "@/lib/prisma-client";

type Tx = Pick<
  Prisma.TransactionClient,
  "catalogItemVendor" | "vendorCatalogItemPrice"
>;

export async function upsertCatalogItemVendorLinks(
  tx: Tx,
  rows: { catalogItemId: string; vendorId: string }[],
  linkedById: string,
) {
  for (const row of rows) {
    await tx.catalogItemVendor.upsert({
      where: {
        catalogItemId_vendorId: {
          catalogItemId: row.catalogItemId,
          vendorId: row.vendorId,
        },
      },
      create: {
        catalogItemId: row.catalogItemId,
        vendorId: row.vendorId,
        linkedById,
      },
      update: {
        lastLinkedAt: new Date(),
        linkedById,
      },
    });
  }
}

export async function recordVendorCatalogItemPrices(
  tx: Tx,
  rows: {
    catalogItemId: string;
    vendorId: string;
    unitPrice: number;
    source: VendorItemPriceSource;
    poId?: string;
    prId?: string;
    recordedById: string;
    notes?: string;
  }[],
) {
  if (rows.length === 0) {
    return;
  }
  await tx.vendorCatalogItemPrice.createMany({
    data: rows.map((row) => ({
      catalogItemId: row.catalogItemId,
      vendorId: row.vendorId,
      unitPrice: row.unitPrice,
      source: row.source,
      poId: row.poId ?? null,
      prId: row.prId ?? null,
      recordedById: row.recordedById,
      notes: row.notes ?? null,
    })),
  });
}

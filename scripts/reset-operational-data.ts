/**
 * Wipes operational procurement data while keeping platform master data:
 * User, UserWarehouse, Warehouse, Vendor, VendorChangeLog, Category,
 * Subcategory, CatalogItem, CatalogItemVendor, VendorCatalogItemPrice, SeriesConfig.
 *
 * Usage: pnpm db:reset-fresh
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/prisma-client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "",
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

/** Procurement / finance / serial activity — safe to wipe. */
const TRUNCATE_TABLES = [
  "AdminAuditLog",
  "Payment",
  "InvoiceGRNLink",
  "Invoice",
  "GRNException",
  "GoodsReceiptLineItem",
  "GoodsReceiptLine",
  "GoodsReceipt",
  "SerialReservation",
  "POAdvanceAllocation",
  "POAdvancePayment",
  "POAdvanceRequest",
  "PurchaseOrderLineAdjustment",
  "PurchaseOrderLineItem",
  "PurchaseOrderLine",
  "PurchaseOrder",
  "PRVersion",
  "PurchaseRequestLineItem",
  "PurchaseRequestLine",
  "VendorRequest",
  "PurchaseRequest",
] as const;

async function clearOperationalData() {
  const [users, warehouses, vendors, catalogItems] = await Promise.all([
    prisma.user.count(),
    prisma.warehouse.count(),
    prisma.vendor.count(),
    prisma.catalogItem.count(),
  ]);

  console.log(
    `Keeping ${users} user(s), ${warehouses} warehouse(s), ${vendors} vendor(s), ${catalogItems} catalog item(s).`,
  );

  const tableList = TRUNCATE_TABLES.map((t) => `"${t}"`).join(", ");
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`,
  );

  console.log("Operational data cleared (PRs, POs, GRNs, invoices, payments, serials).");
}

async function main() {
  await clearOperationalData();
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});

/**
 * Wipes operational data while keeping User, Warehouse, and UserWarehouse rows.
 * Re-seeds categories, subcategories, and series config (no sample vendors/PRs).
 *
 * Usage: dotenv -e .env.local -- tsx scripts/reset-operational-data.ts
 */
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();

const TRUNCATE_TABLES = [
  "Payment",
  "InvoiceGRNLink",
  "Invoice",
  "GRNException",
  "GoodsReceiptLineItem",
  "GoodsReceiptLine",
  "GoodsReceipt",
  "SerialReservation",
  "PurchaseOrderLineItem",
  "PurchaseOrderLine",
  "PurchaseOrder",
  "PRVersion",
  "PurchaseRequestLineItem",
  "PurchaseRequestLine",
  "CatalogItem",
  "VendorRequest",
  "PurchaseRequest",
  "VendorChangeLog",
  "Vendor",
  "SeriesConfig",
  "Subcategory",
  "Category",
] as const;

async function clearOperationalData() {
  const [users, warehouses] = await Promise.all([
    prisma.user.count(),
    prisma.warehouse.count(),
  ]);

  console.log(`Keeping ${users} user(s) and ${warehouses} warehouse(s).`);

  const tableList = TRUNCATE_TABLES.map((t) => `"${t}"`).join(", ");
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`,
  );

  console.log("Operational data cleared.");
}

async function main() {
  await clearOperationalData();
  await prisma.$disconnect();

  process.env.SEED_SKIP_SAMPLES = "1";
  const { execSync } = await import("node:child_process");
  execSync("npx tsx prisma/seed.ts", {
    stdio: "inherit",
    env: process.env,
  });
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});

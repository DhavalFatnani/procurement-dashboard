-- CreateEnum
CREATE TYPE "CategoryBillingGranularity" AS ENUM ('CATALOG_ITEM', 'SUBCATEGORY');

-- CreateEnum
CREATE TYPE "TaxonomyStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable: Category
ALTER TABLE "Category" ADD COLUMN "billingGranularity" "CategoryBillingGranularity";
ALTER TABLE "Category" ADD COLUMN "status" "TaxonomyStatus" NOT NULL DEFAULT 'ACTIVE';

-- Backfill billing granularity from seed category names
UPDATE "Category"
SET "billingGranularity" = 'CATALOG_ITEM'
WHERE "name" IN ('Warehouse Maintenance', 'IT and Hardware Assets');

UPDATE "Category"
SET "billingGranularity" = 'SUBCATEGORY'
WHERE "name" IN ('Packaging', 'Lock Tags', 'Last Mile');

-- Default any remaining rows to SUBCATEGORY
UPDATE "Category"
SET "billingGranularity" = 'SUBCATEGORY'
WHERE "billingGranularity" IS NULL;

ALTER TABLE "Category" ALTER COLUMN "billingGranularity" SET NOT NULL;

-- AlterTable: Subcategory
ALTER TABLE "Subcategory" ADD COLUMN "status" "TaxonomyStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Subcategory_categoryId_name_key" ON "Subcategory"("categoryId", "name");

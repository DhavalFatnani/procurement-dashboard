-- Four-scenario dispute resolution + disputed catalog variants

CREATE TYPE "CatalogItemKind" AS ENUM ('BASE', 'DISPUTED');
CREATE TYPE "GRNExceptionOutcome" AS ENUM (
  'ACCEPT_AT_PO_PRICE',
  'ACCEPT_AT_DISPUTED_PRICE',
  'RETURN_AND_SETTLE',
  'REPLACE_AND_AWAIT_GRN'
);

ALTER TABLE "CatalogItem" ADD COLUMN "kind" "CatalogItemKind" NOT NULL DEFAULT 'BASE';
ALTER TABLE "CatalogItem" ADD COLUMN "baseCatalogItemId" TEXT;
CREATE INDEX "CatalogItem_baseCatalogItemId_kind_idx" ON "CatalogItem"("baseCatalogItemId", "kind");
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_baseCatalogItemId_fkey"
  FOREIGN KEY ("baseCatalogItemId") REFERENCES "CatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderLineItem" ALTER COLUMN "prLineItemId" DROP NOT NULL;
ALTER TABLE "PurchaseOrderLineItem" ADD COLUMN "sourcePoLineItemId" TEXT;
ALTER TABLE "PurchaseOrderLineItem" ADD COLUMN "originatingGrnExceptionId" TEXT;
CREATE UNIQUE INDEX "PurchaseOrderLineItem_originatingGrnExceptionId_key"
  ON "PurchaseOrderLineItem"("originatingGrnExceptionId");
CREATE INDEX "PurchaseOrderLineItem_sourcePoLineItemId_idx"
  ON "PurchaseOrderLineItem"("sourcePoLineItemId");
ALTER TABLE "PurchaseOrderLineItem" ADD CONSTRAINT "PurchaseOrderLineItem_sourcePoLineItemId_fkey"
  FOREIGN KEY ("sourcePoLineItemId") REFERENCES "PurchaseOrderLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLineItem" ADD CONSTRAINT "PurchaseOrderLineItem_originatingGrnExceptionId_fkey"
  FOREIGN KEY ("originatingGrnExceptionId") REFERENCES "GRNException"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GRNException" ADD COLUMN "resolutionOutcome" "GRNExceptionOutcome";
ALTER TABLE "GRNException" ADD COLUMN "pendingReplacementQty" INTEGER;
ALTER TABLE "GRNException" ADD COLUMN "disputeVariantCatalogItemId" TEXT;
CREATE INDEX "GRNException_resolutionOutcome_idx" ON "GRNException"("resolutionOutcome");
ALTER TABLE "GRNException" ADD CONSTRAINT "GRNException_disputeVariantCatalogItemId_fkey"
  FOREIGN KEY ("disputeVariantCatalogItemId") REFERENCES "CatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill resolutionOutcome from legacy disposition + closeLineAfterResolve
UPDATE "GRNException" ex
SET "resolutionOutcome" = CASE
  WHEN ex."resolutionDisposition" = 'KEEP' AND ex."closeLineAfterResolve" = false THEN 'ACCEPT_AT_PO_PRICE'::"GRNExceptionOutcome"
  WHEN ex."resolutionDisposition" = 'KEEP' AND ex."closeLineAfterResolve" = true THEN 'ACCEPT_AT_PO_PRICE'::"GRNExceptionOutcome"
  WHEN ex."resolutionDisposition" IN ('RETURN_TO_VENDOR', 'NOT_RETURNED') AND ex."closeLineAfterResolve" = true THEN 'RETURN_AND_SETTLE'::"GRNExceptionOutcome"
  WHEN ex."resolutionDisposition" = 'RETURN_TO_VENDOR' AND (ex."closeLineAfterResolve" = false OR ex."closeLineAfterResolve" IS NULL) THEN 'REPLACE_AND_AWAIT_GRN'::"GRNExceptionOutcome"
  WHEN ex."resolutionDisposition" = 'NOT_RETURNED' AND (ex."closeLineAfterResolve" = false OR ex."closeLineAfterResolve" IS NULL) THEN 'RETURN_AND_SETTLE'::"GRNExceptionOutcome"
  ELSE NULL
END
WHERE ex."resolutionStatus" IS NOT NULL;

-- Rows with line-wide price adjustment (legacy repricing) → repriced accept
UPDATE "GRNException" ex
SET "resolutionOutcome" = 'ACCEPT_AT_DISPUTED_PRICE'::"GRNExceptionOutcome"
FROM "PurchaseOrderLineAdjustment" adj
WHERE adj."grnExceptionId" = ex."id"
  AND ex."resolutionDisposition" = 'KEEP'
  AND adj."effectiveOrderedQty" = adj."originalOrderedQty"
  AND adj."effectiveUnitPrice" <> adj."originalUnitPrice";

-- Pending replacement for legacy return + expect replacement
UPDATE "GRNException" ex
SET "pendingReplacementQty" = ex."exceptionQty"
WHERE ex."resolutionOutcome" = 'REPLACE_AND_AWAIT_GRN'::"GRNExceptionOutcome"
  AND ex."pendingReplacementQty" IS NULL;

-- Link GRN exceptions to receipt line items (item-level disputes)
ALTER TABLE "GRNException" ADD COLUMN "poLineItemId" TEXT;
ALTER TABLE "GRNException" ADD COLUMN "poLineId" TEXT;

CREATE INDEX "GRNException_poLineItemId_idx" ON "GRNException"("poLineItemId");
CREATE INDEX "GRNException_poLineId_idx" ON "GRNException"("poLineId");

ALTER TABLE "GRNException" ADD CONSTRAINT "GRNException_poLineItemId_fkey" FOREIGN KEY ("poLineItemId") REFERENCES "PurchaseOrderLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GRNException" ADD CONSTRAINT "GRNException_poLineId_fkey" FOREIGN KEY ("poLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill line link from disputed receipt lines (single-line receipts first)
UPDATE "GRNException" e
SET "poLineItemId" = gli."poLineItemId"
FROM "GoodsReceiptLineItem" gli
WHERE gli."grnId" = e."grnId"
  AND gli."disputedQty" > 0
  AND e."poLineItemId" IS NULL
  AND (
    SELECT COUNT(*) FROM "GoodsReceiptLineItem" x
    WHERE x."grnId" = e."grnId" AND x."disputedQty" > 0
  ) = 1;

UPDATE "GRNException" e
SET "poLineId" = gl."poLineId"
FROM "GoodsReceiptLine" gl
WHERE gl."grnId" = e."grnId"
  AND gl."disputedQty" > 0
  AND e."poLineId" IS NULL
  AND e."poLineItemId" IS NULL
  AND (
    SELECT COUNT(*) FROM "GoodsReceiptLine" x
    WHERE x."grnId" = e."grnId" AND x."disputedQty" > 0
  ) = 1;

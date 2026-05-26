-- Create line-item tables for multi-line PR → single PO flow

-- AlterTable: make legacy PR/PO header fields optional
ALTER TABLE "PurchaseRequest" ALTER COLUMN "categoryId" DROP NOT NULL;
ALTER TABLE "PurchaseRequest" ALTER COLUMN "subcategoryId" DROP NOT NULL;
ALTER TABLE "PurchaseRequest" ALTER COLUMN "quantity" DROP NOT NULL;

ALTER TABLE "PurchaseOrder" ALTER COLUMN "orderedQty" DROP NOT NULL;
ALTER TABLE "PurchaseOrder" ALTER COLUMN "unitPrice" DROP NOT NULL;

-- CreateTable PurchaseRequestLine
CREATE TABLE "PurchaseRequestLine" (
    "id" TEXT NOT NULL,
    "prId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "categoryId" TEXT NOT NULL,
    "subcategoryId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "PurchaseRequestLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable PurchaseOrderLine
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "prLineId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "subcategoryId" TEXT NOT NULL,
    "orderedQty" INTEGER NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable GoodsReceiptLine
CREATE TABLE "GoodsReceiptLine" (
    "id" TEXT NOT NULL,
    "grnId" TEXT NOT NULL,
    "poLineId" TEXT NOT NULL,
    "receivedQty" INTEGER NOT NULL,
    "acceptedQty" INTEGER NOT NULL,
    "disputedQty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GoodsReceiptLine_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "PurchaseRequestLine_prId_lineNumber_key" ON "PurchaseRequestLine"("prId", "lineNumber");
CREATE INDEX "PurchaseRequestLine_prId_idx" ON "PurchaseRequestLine"("prId");
CREATE INDEX "PurchaseRequestLine_categoryId_idx" ON "PurchaseRequestLine"("categoryId");
CREATE INDEX "PurchaseRequestLine_subcategoryId_idx" ON "PurchaseRequestLine"("subcategoryId");

CREATE UNIQUE INDEX "PurchaseOrderLine_prLineId_key" ON "PurchaseOrderLine"("prLineId");
CREATE INDEX "PurchaseOrderLine_poId_idx" ON "PurchaseOrderLine"("poId");
CREATE INDEX "PurchaseOrderLine_categoryId_idx" ON "PurchaseOrderLine"("categoryId");
CREATE INDEX "PurchaseOrderLine_subcategoryId_idx" ON "PurchaseOrderLine"("subcategoryId");

CREATE UNIQUE INDEX "GoodsReceiptLine_grnId_poLineId_key" ON "GoodsReceiptLine"("grnId", "poLineId");
CREATE INDEX "GoodsReceiptLine_grnId_idx" ON "GoodsReceiptLine"("grnId");
CREATE INDEX "GoodsReceiptLine_poLineId_idx" ON "GoodsReceiptLine"("poLineId");

-- Foreign keys
ALTER TABLE "PurchaseRequestLine" ADD CONSTRAINT "PurchaseRequestLine_prId_fkey" FOREIGN KEY ("prId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseRequestLine" ADD CONSTRAINT "PurchaseRequestLine_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseRequestLine" ADD CONSTRAINT "PurchaseRequestLine_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_prLineId_fkey" FOREIGN KEY ("prLineId") REFERENCES "PurchaseRequestLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_poLineId_fkey" FOREIGN KEY ("poLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: one PR line per existing purchase request with header data
INSERT INTO "PurchaseRequestLine" ("id", "prId", "lineNumber", "categoryId", "subcategoryId", "quantity")
SELECT
    'prl-' || pr."id" || '-1',
    pr."id",
    1,
    pr."categoryId",
    pr."subcategoryId",
    pr."quantity"
FROM "PurchaseRequest" pr
WHERE pr."categoryId" IS NOT NULL
  AND pr."subcategoryId" IS NOT NULL
  AND pr."quantity" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "PurchaseRequestLine" prl WHERE prl."prId" = pr."id"
  );

-- Backfill: one PO line per existing purchase order
INSERT INTO "PurchaseOrderLine" ("id", "poId", "prLineId", "categoryId", "subcategoryId", "orderedQty", "unitPrice")
SELECT
    'pol-' || po."id" || '-1',
    po."id",
    prl."id",
    prl."categoryId",
    prl."subcategoryId",
    COALESCE(po."orderedQty", prl."quantity"),
    COALESCE(po."unitPrice", 0)
FROM "PurchaseOrder" po
JOIN "PurchaseRequestLine" prl ON prl."prId" = po."prId" AND prl."lineNumber" = 1
WHERE NOT EXISTS (
    SELECT 1 FROM "PurchaseOrderLine" pol WHERE pol."poId" = po."id"
);

-- Backfill: one GRN line per existing goods receipt (linked to first PO line)
INSERT INTO "GoodsReceiptLine" ("id", "grnId", "poLineId", "receivedQty", "acceptedQty", "disputedQty")
SELECT
    'grl-' || grn."id" || '-1',
    grn."id",
    pol."id",
    grn."receivedQty",
    grn."acceptedQty",
    grn."disputedQty"
FROM "GoodsReceipt" grn
JOIN "PurchaseOrderLine" pol ON pol."poId" = grn."poId"
WHERE pol."prLineId" = (
    SELECT prl."id" FROM "PurchaseRequestLine" prl
    JOIN "PurchaseOrder" po ON po."prId" = prl."prId"
    WHERE po."id" = grn."poId"
    ORDER BY prl."lineNumber"
    LIMIT 1
)
AND NOT EXISTS (
    SELECT 1 FROM "GoodsReceiptLine" grl WHERE grl."grnId" = grn."id"
);

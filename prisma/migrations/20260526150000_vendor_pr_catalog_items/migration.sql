-- Vendor PR catalog items and item-level billing

CREATE TYPE "CatalogItemStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'INACTIVE');

-- Nullable line qty (vendor uses line items)
ALTER TABLE "PurchaseRequestLine" ALTER COLUMN "quantity" DROP NOT NULL;

CREATE TABLE "CatalogItem" (
    "id" TEXT NOT NULL,
    "subcategoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "status" "CatalogItemStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseRequestLineItem" (
    "id" TEXT NOT NULL,
    "prLineId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "lineItemNumber" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "PurchaseRequestLineItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseOrderLineItem" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "prLineItemId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "subcategoryId" TEXT NOT NULL,
    "orderedQty" INTEGER NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "PurchaseOrderLineItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GoodsReceiptLineItem" (
    "id" TEXT NOT NULL,
    "grnId" TEXT NOT NULL,
    "poLineItemId" TEXT NOT NULL,
    "receivedQty" INTEGER NOT NULL,
    "acceptedQty" INTEGER NOT NULL,
    "disputedQty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GoodsReceiptLineItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CatalogItem_subcategoryId_name_key" ON "CatalogItem"("subcategoryId", "name");
CREATE INDEX "CatalogItem_subcategoryId_status_idx" ON "CatalogItem"("subcategoryId", "status");
CREATE INDEX "CatalogItem_createdById_idx" ON "CatalogItem"("createdById");

CREATE UNIQUE INDEX "PurchaseRequestLineItem_prLineId_catalogItemId_key" ON "PurchaseRequestLineItem"("prLineId", "catalogItemId");
CREATE UNIQUE INDEX "PurchaseRequestLineItem_prLineId_lineItemNumber_key" ON "PurchaseRequestLineItem"("prLineId", "lineItemNumber");
CREATE INDEX "PurchaseRequestLineItem_prLineId_idx" ON "PurchaseRequestLineItem"("prLineId");
CREATE INDEX "PurchaseRequestLineItem_catalogItemId_idx" ON "PurchaseRequestLineItem"("catalogItemId");

CREATE UNIQUE INDEX "PurchaseOrderLineItem_prLineItemId_key" ON "PurchaseOrderLineItem"("prLineItemId");
CREATE INDEX "PurchaseOrderLineItem_poId_idx" ON "PurchaseOrderLineItem"("poId");
CREATE INDEX "PurchaseOrderLineItem_catalogItemId_idx" ON "PurchaseOrderLineItem"("catalogItemId");
CREATE INDEX "PurchaseOrderLineItem_categoryId_idx" ON "PurchaseOrderLineItem"("categoryId");
CREATE INDEX "PurchaseOrderLineItem_subcategoryId_idx" ON "PurchaseOrderLineItem"("subcategoryId");

CREATE UNIQUE INDEX "GoodsReceiptLineItem_grnId_poLineItemId_key" ON "GoodsReceiptLineItem"("grnId", "poLineItemId");
CREATE INDEX "GoodsReceiptLineItem_grnId_idx" ON "GoodsReceiptLineItem"("grnId");
CREATE INDEX "GoodsReceiptLineItem_poLineItemId_idx" ON "GoodsReceiptLineItem"("poLineItemId");

ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseRequestLineItem" ADD CONSTRAINT "PurchaseRequestLineItem_prLineId_fkey" FOREIGN KEY ("prLineId") REFERENCES "PurchaseRequestLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseRequestLineItem" ADD CONSTRAINT "PurchaseRequestLineItem_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderLineItem" ADD CONSTRAINT "PurchaseOrderLineItem_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLineItem" ADD CONSTRAINT "PurchaseOrderLineItem_prLineItemId_fkey" FOREIGN KEY ("prLineItemId") REFERENCES "PurchaseRequestLineItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLineItem" ADD CONSTRAINT "PurchaseOrderLineItem_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLineItem" ADD CONSTRAINT "PurchaseOrderLineItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLineItem" ADD CONSTRAINT "PurchaseOrderLineItem_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GoodsReceiptLineItem" ADD CONSTRAINT "GoodsReceiptLineItem_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoodsReceiptLineItem" ADD CONSTRAINT "GoodsReceiptLineItem_poLineItemId_fkey" FOREIGN KEY ("poLineItemId") REFERENCES "PurchaseOrderLineItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill catalog items + PR line items from existing PR lines (vendor purchase only)
INSERT INTO "CatalogItem" ("id", "subcategoryId", "name", "unit", "status", "createdById", "approvedById", "approvedAt", "createdAt", "updatedAt")
SELECT DISTINCT ON (prl."subcategoryId", sub."name")
    'cat-' || prl."subcategoryId" || '-' || md5(sub."name"),
    prl."subcategoryId",
    sub."name",
    'pcs',
    'ACTIVE'::"CatalogItemStatus",
    pr."createdById",
    pr."createdById",
    NOW(),
    NOW(),
    NOW()
FROM "PurchaseRequestLine" prl
JOIN "PurchaseRequest" pr ON pr."id" = prl."prId"
JOIN "Subcategory" sub ON sub."id" = prl."subcategoryId"
WHERE pr."executionType" = 'VENDOR_PURCHASE'
  AND NOT EXISTS (
    SELECT 1 FROM "CatalogItem" ci
    WHERE ci."subcategoryId" = prl."subcategoryId" AND ci."name" = sub."name"
  );

INSERT INTO "PurchaseRequestLineItem" ("id", "prLineId", "catalogItemId", "lineItemNumber", "quantity")
SELECT
    'prli-' || prl."id" || '-1',
    prl."id",
    ci."id",
    1,
    COALESCE(prl."quantity", 1)
FROM "PurchaseRequestLine" prl
JOIN "PurchaseRequest" pr ON pr."id" = prl."prId"
JOIN "Subcategory" sub ON sub."id" = prl."subcategoryId"
JOIN "CatalogItem" ci ON ci."subcategoryId" = prl."subcategoryId" AND ci."name" = sub."name"
WHERE pr."executionType" = 'VENDOR_PURCHASE'
  AND NOT EXISTS (
    SELECT 1 FROM "PurchaseRequestLineItem" x WHERE x."prLineId" = prl."id"
  );

-- Backfill PO line items from existing PO lines
INSERT INTO "PurchaseOrderLineItem" ("id", "poId", "prLineItemId", "catalogItemId", "categoryId", "subcategoryId", "orderedQty", "unitPrice")
SELECT
    'poli-' || pol."id",
    pol."poId",
    prli."id",
    prli."catalogItemId",
    pol."categoryId",
    pol."subcategoryId",
    pol."orderedQty",
    pol."unitPrice"
FROM "PurchaseOrderLine" pol
JOIN "PurchaseRequestLineItem" prli ON prli."prLineId" = pol."prLineId"
WHERE NOT EXISTS (
    SELECT 1 FROM "PurchaseOrderLineItem" x WHERE x."prLineItemId" = prli."id"
);

-- Backfill GRN line items from GRN lines (map via PO line -> PO line item)
INSERT INTO "GoodsReceiptLineItem" ("id", "grnId", "poLineItemId", "receivedQty", "acceptedQty", "disputedQty")
SELECT
    'grli-' || grl."id",
    grl."grnId",
    poli."id",
    grl."receivedQty",
    grl."acceptedQty",
    grl."disputedQty"
FROM "GoodsReceiptLine" grl
JOIN "PurchaseOrderLine" pol ON pol."id" = grl."poLineId"
JOIN "PurchaseOrderLineItem" poli ON poli."prLineItemId" = (
    SELECT prli."id" FROM "PurchaseRequestLineItem" prli WHERE prli."prLineId" = pol."prLineId" LIMIT 1
)
WHERE NOT EXISTS (
    SELECT 1 FROM "GoodsReceiptLineItem" x WHERE x."grnId" = grl."grnId" AND x."poLineItemId" = poli."id"
);

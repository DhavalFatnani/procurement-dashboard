-- CreateTable
CREATE TABLE "PurchaseOrderLineAdjustment" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "poLineItemId" TEXT,
    "poLineId" TEXT,
    "grnExceptionId" TEXT NOT NULL,
    "originalOrderedQty" INTEGER NOT NULL,
    "effectiveOrderedQty" INTEGER NOT NULL,
    "originalUnitPrice" DECIMAL(18,4) NOT NULL,
    "effectiveUnitPrice" DECIMAL(18,4) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrderLineAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrderLineAdjustment_grnExceptionId_key" ON "PurchaseOrderLineAdjustment"("grnExceptionId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLineAdjustment_poId_idx" ON "PurchaseOrderLineAdjustment"("poId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLineAdjustment_poLineItemId_idx" ON "PurchaseOrderLineAdjustment"("poLineItemId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLineAdjustment_poLineId_idx" ON "PurchaseOrderLineAdjustment"("poLineId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLineAdjustment_createdAt_idx" ON "PurchaseOrderLineAdjustment"("createdAt");

-- AddForeignKey
ALTER TABLE "PurchaseOrderLineAdjustment" ADD CONSTRAINT "PurchaseOrderLineAdjustment_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLineAdjustment" ADD CONSTRAINT "PurchaseOrderLineAdjustment_poLineItemId_fkey" FOREIGN KEY ("poLineItemId") REFERENCES "PurchaseOrderLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLineAdjustment" ADD CONSTRAINT "PurchaseOrderLineAdjustment_poLineId_fkey" FOREIGN KEY ("poLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLineAdjustment" ADD CONSTRAINT "PurchaseOrderLineAdjustment_grnExceptionId_fkey" FOREIGN KEY ("grnExceptionId") REFERENCES "GRNException"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLineAdjustment" ADD CONSTRAINT "PurchaseOrderLineAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

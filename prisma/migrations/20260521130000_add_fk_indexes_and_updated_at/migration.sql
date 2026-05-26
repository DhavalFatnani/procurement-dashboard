-- AlterTable
ALTER TABLE "GRNException" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "GoodsReceipt" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "SerialReservation" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "SeriesConfig" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "GRNException_grnId_idx" ON "GRNException"("grnId");

-- CreateIndex
CREATE INDEX "GoodsReceipt_poId_idx" ON "GoodsReceipt"("poId");

-- CreateIndex
CREATE INDEX "InvoiceGRNLink_grnId_idx" ON "InvoiceGRNLink"("grnId");

-- CreateIndex
CREATE INDEX "PRVersion_prId_idx" ON "PRVersion"("prId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_createdById_idx" ON "PurchaseRequest"("createdById");

-- CreateIndex
CREATE INDEX "PurchaseRequest_categoryId_idx" ON "PurchaseRequest"("categoryId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_subcategoryId_idx" ON "PurchaseRequest"("subcategoryId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_vendorId_idx" ON "PurchaseRequest"("vendorId");

-- CreateIndex
CREATE INDEX "SerialReservation_series_idx" ON "SerialReservation"("series");

-- CreateIndex
CREATE INDEX "SerialReservation_warehouseId_idx" ON "SerialReservation"("warehouseId");

-- CreateIndex
CREATE INDEX "SerialReservation_createdById_idx" ON "SerialReservation"("createdById");

-- CreateIndex
CREATE INDEX "Vendor_createdById_idx" ON "Vendor"("createdById");

-- CreateIndex
CREATE INDEX "VendorChangeLog_vendorId_idx" ON "VendorChangeLog"("vendorId");

-- CreateIndex
CREATE INDEX "VendorChangeLog_changedById_idx" ON "VendorChangeLog"("changedById");


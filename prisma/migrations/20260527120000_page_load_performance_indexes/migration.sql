-- CreateIndex
CREATE INDEX "PurchaseRequest_warehouseId_createdAt_idx" ON "PurchaseRequest"("warehouseId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Invoice_paymentStatus_idx" ON "Invoice"("paymentStatus");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

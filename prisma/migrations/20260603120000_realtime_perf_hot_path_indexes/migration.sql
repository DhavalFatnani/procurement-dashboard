-- Hot-path indexes for the inbox, dashboard recent-activity, finance, and list
-- flows. Each column below was ordered-by or filtered in a frequently-run query
-- with no supporting index, forcing sequential scans (amplified by the
-- previously-serialized DB access layer). Postgres does not auto-index foreign
-- keys, so unindexed FKs used in joins/filters are included too.

-- CreateIndex
CREATE INDEX "PurchaseOrder_updatedAt_idx" ON "PurchaseOrder"("updatedAt");

-- CreateIndex
CREATE INDEX "PurchaseRequest_updatedAt_idx" ON "PurchaseRequest"("updatedAt");

-- CreateIndex
CREATE INDEX "GoodsReceipt_receivedById_idx" ON "GoodsReceipt"("receivedById");

-- CreateIndex
CREATE INDEX "GRNException_resolutionStatus_idx" ON "GRNException"("resolutionStatus");

-- CreateIndex
CREATE INDEX "Invoice_updatedAt_idx" ON "Invoice"("updatedAt");

-- CreateIndex
CREATE INDEX "Invoice_matchStatus_idx" ON "Invoice"("matchStatus");

-- CreateIndex
CREATE INDEX "Invoice_uploadedById_idx" ON "Invoice"("uploadedById");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE INDEX "Payment_paidById_idx" ON "Payment"("paidById");

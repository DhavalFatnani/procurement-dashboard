-- CreateEnum
CREATE TYPE "POAdvanceRequestStatus" AS ENUM ('PENDING', 'CANCELLED', 'REJECTED', 'FULFILLED');

-- CreateTable
CREATE TABLE "POAdvanceRequest" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "requestedAmount" DECIMAL(18,4) NOT NULL,
    "requestedPercent" DECIMAL(6,3),
    "reason" TEXT NOT NULL,
    "status" "POAdvanceRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "POAdvanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "POAdvancePayment" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "method" TEXT,
    "transactionRef" TEXT NOT NULL,
    "proofUrl" TEXT,
    "paidById" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "POAdvancePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "POAdvanceAllocation" (
    "id" TEXT NOT NULL,
    "advancePaymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "POAdvanceAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "POAdvanceRequest_poId_idx" ON "POAdvanceRequest"("poId");
CREATE INDEX "POAdvanceRequest_status_idx" ON "POAdvanceRequest"("status");
CREATE INDEX "POAdvanceRequest_requestedAt_idx" ON "POAdvanceRequest"("requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "POAdvancePayment_requestId_key" ON "POAdvancePayment"("requestId");
CREATE INDEX "POAdvancePayment_poId_idx" ON "POAdvancePayment"("poId");
CREATE INDEX "POAdvancePayment_paidAt_idx" ON "POAdvancePayment"("paidAt");

-- CreateIndex
CREATE INDEX "POAdvanceAllocation_advancePaymentId_idx" ON "POAdvanceAllocation"("advancePaymentId");
CREATE INDEX "POAdvanceAllocation_invoiceId_idx" ON "POAdvanceAllocation"("invoiceId");

-- AddForeignKey
ALTER TABLE "POAdvanceRequest" ADD CONSTRAINT "POAdvanceRequest_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "POAdvanceRequest" ADD CONSTRAINT "POAdvanceRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "POAdvanceRequest" ADD CONSTRAINT "POAdvanceRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POAdvancePayment" ADD CONSTRAINT "POAdvancePayment_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "POAdvancePayment" ADD CONSTRAINT "POAdvancePayment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "POAdvanceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "POAdvancePayment" ADD CONSTRAINT "POAdvancePayment_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POAdvanceAllocation" ADD CONSTRAINT "POAdvanceAllocation_advancePaymentId_fkey" FOREIGN KEY ("advancePaymentId") REFERENCES "POAdvancePayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "POAdvanceAllocation" ADD CONSTRAINT "POAdvanceAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

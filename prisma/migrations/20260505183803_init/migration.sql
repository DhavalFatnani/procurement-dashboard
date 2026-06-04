-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SM', 'OPS_HEAD', 'FINANCE');

-- CreateEnum
CREATE TYPE "PRStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED', 'CONVERTED_TO_PO', 'EXECUTED_PRINT', 'CANCELLED', 'FORCE_CANCELLED');

-- CreateEnum
CREATE TYPE "ExecutionType" AS ENUM ('VENDOR_PURCHASE', 'INTERNAL_PRINT');

-- CreateEnum
CREATE TYPE "POStatus" AS ENUM ('OPEN', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'INVOICED', 'PAID', 'CLOSED', 'PARTIALLY_CLOSED', 'FORCE_CLOSED');

-- CreateEnum
CREATE TYPE "GRNExceptionType" AS ENUM ('DAMAGED', 'WRONG_ITEM', 'QUANTITY_SHORT', 'QUALITY_REJECTION');

-- CreateEnum
CREATE TYPE "GRNExceptionResolution" AS ENUM ('ACCEPTED', 'RETURNED_TO_VENDOR', 'OVERRIDE_ACCEPTED');

-- CreateEnum
CREATE TYPE "InvoiceMatchStatus" AS ENUM ('PENDING', 'MATCHED', 'MISMATCH', 'OVERRIDE_ACCEPTED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "VendorRequestStatus" AS ENUM ('PENDING', 'ACTIVATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SerialSeries" AS ENUM ('LOCK_TAGS', 'JEWELLERY_BARCODES', 'APPAREL_BARCODES');

-- CreateEnum
CREATE TYPE "SerialReservationStatus" AS ENUM ('PENDING', 'RESERVED');

-- CreateEnum
CREATE TYPE "CatalogItemStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "VendorItemPriceSource" AS ENUM ('PO', 'CONFIGURE');

-- CreateEnum
CREATE TYPE "SeriesConfigStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'WARNING');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWarehouse" (
    "userId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,

    CONSTRAINT "UserWarehouse_pkey" PRIMARY KEY ("userId","warehouseId")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "gst" TEXT,
    "address" TEXT,
    "pocName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ifsc" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "status" "VendorStatus" NOT NULL DEFAULT 'ACTIVE',
    "hasSimilarVendorFlag" BOOLEAN NOT NULL DEFAULT false,
    "similarVendorId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorChangeLog" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "VendorChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorRequest" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "pocName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "VendorRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewReason" TEXT,
    "linkedPRId" TEXT,
    "activatedVendorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subcategory" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "series" "SerialSeries",
    "executionType" "ExecutionType" NOT NULL,

    CONSTRAINT "Subcategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "CatalogItemVendor" (
    "catalogItemId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "firstLinkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLinkedAt" TIMESTAMP(3) NOT NULL,
    "linkedById" TEXT,

    CONSTRAINT "CatalogItemVendor_pkey" PRIMARY KEY ("catalogItemId","vendorId")
);

-- CreateTable
CREATE TABLE "VendorCatalogItemPrice" (
    "id" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "source" "VendorItemPriceSource" NOT NULL,
    "poId" TEXT,
    "prId" TEXT,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "VendorCatalogItemPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT,
    "subcategoryId" TEXT,
    "quantity" INTEGER,
    "warehouseId" TEXT NOT NULL,
    "vendorId" TEXT,
    "executionType" "ExecutionType" NOT NULL,
    "status" "PRStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "revisionCount" INTEGER NOT NULL DEFAULT 0,
    "vendorRequestId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequestLine" (
    "id" TEXT NOT NULL,
    "prId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "categoryId" TEXT NOT NULL,
    "subcategoryId" TEXT NOT NULL,
    "quantity" INTEGER,
    "notes" TEXT,

    CONSTRAINT "PurchaseRequestLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequestLineItem" (
    "id" TEXT NOT NULL,
    "prLineId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "lineItemNumber" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "PurchaseRequestLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PRVersion" (
    "id" TEXT NOT NULL,
    "prId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revisionComment" TEXT,
    "diffSnapshot" JSONB,

    CONSTRAINT "PRVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "prId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "orderedQty" INTEGER,
    "unitPrice" DECIMAL(18,4),
    "status" "POStatus" NOT NULL DEFAULT 'OPEN',
    "expectedDelivery" TIMESTAMP(3),
    "deliveryComplete" BOOLEAN NOT NULL DEFAULT false,
    "forceClosedById" TEXT,
    "forceCloseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "GoodsReceipt" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "receivedQty" INTEGER NOT NULL,
    "acceptedQty" INTEGER NOT NULL,
    "disputedQty" INTEGER NOT NULL DEFAULT 0,
    "receivedById" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryNoteRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptLineItem" (
    "id" TEXT NOT NULL,
    "grnId" TEXT NOT NULL,
    "poLineItemId" TEXT NOT NULL,
    "receivedQty" INTEGER NOT NULL,
    "acceptedQty" INTEGER NOT NULL,
    "disputedQty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GoodsReceiptLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptLine" (
    "id" TEXT NOT NULL,
    "grnId" TEXT NOT NULL,
    "poLineId" TEXT NOT NULL,
    "receivedQty" INTEGER NOT NULL,
    "acceptedQty" INTEGER NOT NULL,
    "disputedQty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GoodsReceiptLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GRNException" (
    "id" TEXT NOT NULL,
    "grnId" TEXT NOT NULL,
    "poLineItemId" TEXT,
    "poLineId" TEXT,
    "exceptionType" "GRNExceptionType" NOT NULL,
    "exceptionQty" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "resolutionStatus" "GRNExceptionResolution",
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GRNException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "matchStatus" "InvoiceMatchStatus" NOT NULL DEFAULT 'PENDING',
    "expectedAmount" DECIMAL(18,4),
    "tolerancePct" DECIMAL(6,3) NOT NULL DEFAULT 2.5,
    "overrideById" TEXT,
    "overrideReason" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceGRNLink" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "grnId" TEXT NOT NULL,

    CONSTRAINT "InvoiceGRNLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "amount" DECIMAL(18,4),
    "method" TEXT,
    "proofUrl" TEXT,
    "transactionRef" TEXT,
    "paidById" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SerialReservation" (
    "id" TEXT NOT NULL,
    "series" "SerialSeries" NOT NULL,
    "rangeStart" BIGINT NOT NULL,
    "rangeEnd" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "SerialReservationStatus" NOT NULL DEFAULT 'PENDING',
    "prId" TEXT,
    "poId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SerialReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeriesConfig" (
    "id" TEXT NOT NULL,
    "series" "SerialSeries" NOT NULL,
    "inactivityThresholdDays" INTEGER NOT NULL DEFAULT 30,
    "ceilingNumber" BIGINT NOT NULL,
    "ceilingAlertPct" INTEGER NOT NULL DEFAULT 80,
    "configuredById" TEXT NOT NULL,
    "configuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeriesConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "UserWarehouse_warehouseId_idx" ON "UserWarehouse"("warehouseId");

-- CreateIndex
CREATE INDEX "Vendor_status_idx" ON "Vendor"("status");

-- CreateIndex
CREATE INDEX "Vendor_updatedAt_idx" ON "Vendor"("updatedAt");

-- CreateIndex
CREATE INDEX "Vendor_createdById_idx" ON "Vendor"("createdById");

-- CreateIndex
CREATE INDEX "VendorChangeLog_vendorId_idx" ON "VendorChangeLog"("vendorId");

-- CreateIndex
CREATE INDEX "VendorChangeLog_changedById_idx" ON "VendorChangeLog"("changedById");

-- CreateIndex
CREATE UNIQUE INDEX "VendorRequest_linkedPRId_key" ON "VendorRequest"("linkedPRId");

-- CreateIndex
CREATE INDEX "VendorRequest_status_idx" ON "VendorRequest"("status");

-- CreateIndex
CREATE INDEX "CatalogItem_subcategoryId_status_idx" ON "CatalogItem"("subcategoryId", "status");

-- CreateIndex
CREATE INDEX "CatalogItem_createdById_idx" ON "CatalogItem"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogItem_subcategoryId_name_key" ON "CatalogItem"("subcategoryId", "name");

-- CreateIndex
CREATE INDEX "CatalogItemVendor_vendorId_idx" ON "CatalogItemVendor"("vendorId");

-- CreateIndex
CREATE INDEX "VendorCatalogItemPrice_catalogItemId_vendorId_recordedAt_idx" ON "VendorCatalogItemPrice"("catalogItemId", "vendorId", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "VendorCatalogItemPrice_vendorId_idx" ON "VendorCatalogItemPrice"("vendorId");

-- CreateIndex
CREATE INDEX "VendorCatalogItemPrice_poId_idx" ON "VendorCatalogItemPrice"("poId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_vendorRequestId_key" ON "PurchaseRequest"("vendorRequestId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_status_idx" ON "PurchaseRequest"("status");

-- CreateIndex
CREATE INDEX "PurchaseRequest_warehouseId_status_idx" ON "PurchaseRequest"("warehouseId", "status");

-- CreateIndex
CREATE INDEX "PurchaseRequest_warehouseId_createdAt_idx" ON "PurchaseRequest"("warehouseId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PurchaseRequest_createdAt_idx" ON "PurchaseRequest"("createdAt");

-- CreateIndex
CREATE INDEX "PurchaseRequest_executionType_status_idx" ON "PurchaseRequest"("executionType", "status");

-- CreateIndex
CREATE INDEX "PurchaseRequest_createdById_idx" ON "PurchaseRequest"("createdById");

-- CreateIndex
CREATE INDEX "PurchaseRequest_categoryId_idx" ON "PurchaseRequest"("categoryId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_subcategoryId_idx" ON "PurchaseRequest"("subcategoryId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_vendorId_idx" ON "PurchaseRequest"("vendorId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_updatedAt_idx" ON "PurchaseRequest"("updatedAt");

-- CreateIndex
CREATE INDEX "PurchaseRequestLine_prId_idx" ON "PurchaseRequestLine"("prId");

-- CreateIndex
CREATE INDEX "PurchaseRequestLine_categoryId_idx" ON "PurchaseRequestLine"("categoryId");

-- CreateIndex
CREATE INDEX "PurchaseRequestLine_subcategoryId_idx" ON "PurchaseRequestLine"("subcategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequestLine_prId_lineNumber_key" ON "PurchaseRequestLine"("prId", "lineNumber");

-- CreateIndex
CREATE INDEX "PurchaseRequestLineItem_prLineId_idx" ON "PurchaseRequestLineItem"("prLineId");

-- CreateIndex
CREATE INDEX "PurchaseRequestLineItem_catalogItemId_idx" ON "PurchaseRequestLineItem"("catalogItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequestLineItem_prLineId_catalogItemId_key" ON "PurchaseRequestLineItem"("prLineId", "catalogItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequestLineItem_prLineId_lineItemNumber_key" ON "PurchaseRequestLineItem"("prLineId", "lineItemNumber");

-- CreateIndex
CREATE INDEX "PRVersion_prId_idx" ON "PRVersion"("prId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_prId_idx" ON "PurchaseOrder"("prId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_vendorId_idx" ON "PurchaseOrder"("vendorId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_createdAt_idx" ON "PurchaseOrder"("createdAt");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_createdAt_idx" ON "PurchaseOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PurchaseOrder_updatedAt_idx" ON "PurchaseOrder"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrderLine_prLineId_key" ON "PurchaseOrderLine"("prLineId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_poId_idx" ON "PurchaseOrderLine"("poId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_categoryId_idx" ON "PurchaseOrderLine"("categoryId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_subcategoryId_idx" ON "PurchaseOrderLine"("subcategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrderLineItem_prLineItemId_key" ON "PurchaseOrderLineItem"("prLineItemId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLineItem_poId_idx" ON "PurchaseOrderLineItem"("poId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLineItem_catalogItemId_idx" ON "PurchaseOrderLineItem"("catalogItemId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLineItem_categoryId_idx" ON "PurchaseOrderLineItem"("categoryId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLineItem_subcategoryId_idx" ON "PurchaseOrderLineItem"("subcategoryId");

-- CreateIndex
CREATE INDEX "GoodsReceipt_poId_idx" ON "GoodsReceipt"("poId");

-- CreateIndex
CREATE INDEX "GoodsReceipt_receivedAt_idx" ON "GoodsReceipt"("receivedAt");

-- CreateIndex
CREATE INDEX "GoodsReceipt_receivedById_idx" ON "GoodsReceipt"("receivedById");

-- CreateIndex
CREATE INDEX "GoodsReceiptLineItem_grnId_idx" ON "GoodsReceiptLineItem"("grnId");

-- CreateIndex
CREATE INDEX "GoodsReceiptLineItem_poLineItemId_idx" ON "GoodsReceiptLineItem"("poLineItemId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceiptLineItem_grnId_poLineItemId_key" ON "GoodsReceiptLineItem"("grnId", "poLineItemId");

-- CreateIndex
CREATE INDEX "GoodsReceiptLine_grnId_idx" ON "GoodsReceiptLine"("grnId");

-- CreateIndex
CREATE INDEX "GoodsReceiptLine_poLineId_idx" ON "GoodsReceiptLine"("poLineId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceiptLine_grnId_poLineId_key" ON "GoodsReceiptLine"("grnId", "poLineId");

-- CreateIndex
CREATE INDEX "GRNException_grnId_idx" ON "GRNException"("grnId");

-- CreateIndex
CREATE INDEX "GRNException_poLineItemId_idx" ON "GRNException"("poLineItemId");

-- CreateIndex
CREATE INDEX "GRNException_poLineId_idx" ON "GRNException"("poLineId");

-- CreateIndex
CREATE INDEX "GRNException_resolutionStatus_idx" ON "GRNException"("resolutionStatus");

-- CreateIndex
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");

-- CreateIndex
CREATE INDEX "Invoice_paymentStatus_idx" ON "Invoice"("paymentStatus");

-- CreateIndex
CREATE INDEX "Invoice_updatedAt_idx" ON "Invoice"("updatedAt");

-- CreateIndex
CREATE INDEX "Invoice_matchStatus_idx" ON "Invoice"("matchStatus");

-- CreateIndex
CREATE INDEX "Invoice_uploadedById_idx" ON "Invoice"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_poId_invoiceNumber_key" ON "Invoice"("poId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "InvoiceGRNLink_grnId_idx" ON "InvoiceGRNLink"("grnId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceGRNLink_invoiceId_grnId_key" ON "InvoiceGRNLink"("invoiceId", "grnId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE INDEX "Payment_paidById_idx" ON "Payment"("paidById");

-- CreateIndex
CREATE UNIQUE INDEX "SerialReservation_prId_key" ON "SerialReservation"("prId");

-- CreateIndex
CREATE UNIQUE INDEX "SerialReservation_poId_key" ON "SerialReservation"("poId");

-- CreateIndex
CREATE UNIQUE INDEX "SerialReservation_idempotencyKey_key" ON "SerialReservation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SerialReservation_series_idx" ON "SerialReservation"("series");

-- CreateIndex
CREATE INDEX "SerialReservation_warehouseId_idx" ON "SerialReservation"("warehouseId");

-- CreateIndex
CREATE INDEX "SerialReservation_createdById_idx" ON "SerialReservation"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "SeriesConfig_series_key" ON "SeriesConfig"("series");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWarehouse" ADD CONSTRAINT "UserWarehouse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWarehouse" ADD CONSTRAINT "UserWarehouse_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_similarVendorId_fkey" FOREIGN KEY ("similarVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorChangeLog" ADD CONSTRAINT "VendorChangeLog_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorChangeLog" ADD CONSTRAINT "VendorChangeLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorRequest" ADD CONSTRAINT "VendorRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorRequest" ADD CONSTRAINT "VendorRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorRequest" ADD CONSTRAINT "VendorRequest_linkedPRId_fkey" FOREIGN KEY ("linkedPRId") REFERENCES "PurchaseRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorRequest" ADD CONSTRAINT "VendorRequest_activatedVendorId_fkey" FOREIGN KEY ("activatedVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subcategory" ADD CONSTRAINT "Subcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItemVendor" ADD CONSTRAINT "CatalogItemVendor_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItemVendor" ADD CONSTRAINT "CatalogItemVendor_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItemVendor" ADD CONSTRAINT "CatalogItemVendor_linkedById_fkey" FOREIGN KEY ("linkedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorCatalogItemPrice" ADD CONSTRAINT "VendorCatalogItemPrice_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorCatalogItemPrice" ADD CONSTRAINT "VendorCatalogItemPrice_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorCatalogItemPrice" ADD CONSTRAINT "VendorCatalogItemPrice_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorCatalogItemPrice" ADD CONSTRAINT "VendorCatalogItemPrice_prId_fkey" FOREIGN KEY ("prId") REFERENCES "PurchaseRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorCatalogItemPrice" ADD CONSTRAINT "VendorCatalogItemPrice_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_vendorRequestId_fkey" FOREIGN KEY ("vendorRequestId") REFERENCES "VendorRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestLine" ADD CONSTRAINT "PurchaseRequestLine_prId_fkey" FOREIGN KEY ("prId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestLine" ADD CONSTRAINT "PurchaseRequestLine_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestLine" ADD CONSTRAINT "PurchaseRequestLine_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestLineItem" ADD CONSTRAINT "PurchaseRequestLineItem_prLineId_fkey" FOREIGN KEY ("prLineId") REFERENCES "PurchaseRequestLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestLineItem" ADD CONSTRAINT "PurchaseRequestLineItem_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PRVersion" ADD CONSTRAINT "PRVersion_prId_fkey" FOREIGN KEY ("prId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PRVersion" ADD CONSTRAINT "PRVersion_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_prId_fkey" FOREIGN KEY ("prId") REFERENCES "PurchaseRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_forceClosedById_fkey" FOREIGN KEY ("forceClosedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_prLineId_fkey" FOREIGN KEY ("prLineId") REFERENCES "PurchaseRequestLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLineItem" ADD CONSTRAINT "PurchaseOrderLineItem_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLineItem" ADD CONSTRAINT "PurchaseOrderLineItem_prLineItemId_fkey" FOREIGN KEY ("prLineItemId") REFERENCES "PurchaseRequestLineItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLineItem" ADD CONSTRAINT "PurchaseOrderLineItem_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLineItem" ADD CONSTRAINT "PurchaseOrderLineItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLineItem" ADD CONSTRAINT "PurchaseOrderLineItem_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLineItem" ADD CONSTRAINT "GoodsReceiptLineItem_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLineItem" ADD CONSTRAINT "GoodsReceiptLineItem_poLineItemId_fkey" FOREIGN KEY ("poLineItemId") REFERENCES "PurchaseOrderLineItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_poLineId_fkey" FOREIGN KEY ("poLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRNException" ADD CONSTRAINT "GRNException_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRNException" ADD CONSTRAINT "GRNException_poLineItemId_fkey" FOREIGN KEY ("poLineItemId") REFERENCES "PurchaseOrderLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRNException" ADD CONSTRAINT "GRNException_poLineId_fkey" FOREIGN KEY ("poLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRNException" ADD CONSTRAINT "GRNException_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_overrideById_fkey" FOREIGN KEY ("overrideById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceGRNLink" ADD CONSTRAINT "InvoiceGRNLink_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceGRNLink" ADD CONSTRAINT "InvoiceGRNLink_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialReservation" ADD CONSTRAINT "SerialReservation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialReservation" ADD CONSTRAINT "SerialReservation_prId_fkey" FOREIGN KEY ("prId") REFERENCES "PurchaseRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialReservation" ADD CONSTRAINT "SerialReservation_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialReservation" ADD CONSTRAINT "SerialReservation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeriesConfig" ADD CONSTRAINT "SeriesConfig_configuredById_fkey" FOREIGN KEY ("configuredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

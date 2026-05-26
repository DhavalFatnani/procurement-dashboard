-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "amount" DECIMAL(18,4);

-- Backfill legacy PAID rows with the full invoice amount
UPDATE "Payment" p
SET "amount" = i."amount"
FROM "Invoice" i
WHERE p."invoiceId" = i.id
  AND p.status = 'PAID'
  AND p."amount" IS NULL;

-- Remove empty UNPAID placeholder rows (no transaction recorded)
DELETE FROM "Payment"
WHERE status = 'UNPAID'
  AND "amount" IS NULL
  AND "transactionRef" IS NULL
  AND "paidAt" IS NULL;

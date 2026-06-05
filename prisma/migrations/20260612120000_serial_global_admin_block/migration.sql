-- Admin serial blocks are global (not tied to a warehouse).

ALTER TABLE "SerialReservation" ALTER COLUMN "warehouseId" DROP NOT NULL;

UPDATE "SerialReservation"
SET "warehouseId" = NULL
WHERE "purpose" = 'ADMIN_BLOCK';

-- Admin audit log + serial reservation purpose / soft-release

CREATE TYPE "SerialReservationPurpose" AS ENUM ('INTERNAL_PRINT', 'VENDOR_LOCK_TAGS', 'ADMIN_BLOCK');

CREATE TYPE "AdminAuditAction" AS ENUM (
  'SERIAL_BLOCK',
  'SERIAL_RELEASE',
  'SERIAL_REASSIGN',
  'SERIAL_SPLIT',
  'SERIAL_MERGE',
  'LIFECYCLE_RELEASE'
);

ALTER TYPE "SerialReservationStatus" ADD VALUE 'RELEASED';

ALTER TABLE "SerialReservation"
  ADD COLUMN "purpose" "SerialReservationPurpose" NOT NULL DEFAULT 'INTERNAL_PRINT',
  ADD COLUMN "releasedAt" TIMESTAMP(3),
  ADD COLUMN "releasedById" TEXT,
  ADD COLUMN "releaseReason" TEXT;

UPDATE "SerialReservation"
SET "purpose" = 'VENDOR_LOCK_TAGS'
WHERE "series" = 'LOCK_TAGS';

CREATE INDEX "SerialReservation_releasedById_idx" ON "SerialReservation"("releasedById");
CREATE INDEX "SerialReservation_status_idx" ON "SerialReservation"("status");

ALTER TABLE "SerialReservation"
  ADD CONSTRAINT "SerialReservation_releasedById_fkey"
  FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AdminAuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" "AdminAuditAction" NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "reason" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminAuditLog_actorId_idx" ON "AdminAuditLog"("actorId");
CREATE INDEX "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId");
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

ALTER TABLE "AdminAuditLog"
  ADD CONSTRAINT "AdminAuditLog_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

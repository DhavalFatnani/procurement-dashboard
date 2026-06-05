-- Admin-editable series metadata (display name, prefix pattern).

ALTER TYPE "AdminAuditAction" ADD VALUE IF NOT EXISTS 'SERIES_CONFIG_UPDATE';
ALTER TYPE "AdminAuditAction" ADD VALUE IF NOT EXISTS 'SERIES_CONFIG_RESET';

ALTER TABLE "SeriesConfig"
  ADD COLUMN IF NOT EXISTS "displayName" TEXT,
  ADD COLUMN IF NOT EXISTS "prefixPattern" TEXT;

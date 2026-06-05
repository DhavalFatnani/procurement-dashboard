-- Dynamic serial series registry: drop SerialSeries enum, store series as configurable rows.

ALTER TYPE "AdminAuditAction" ADD VALUE IF NOT EXISTS 'SERIES_CONFIG_CREATE';
ALTER TYPE "AdminAuditAction" ADD VALUE IF NOT EXISTS 'SERIES_CONFIG_DEACTIVATE';

-- SeriesConfig: add registry fields
ALTER TABLE "SeriesConfig"
  ADD COLUMN IF NOT EXISTS "code" TEXT,
  ADD COLUMN IF NOT EXISTS "rangeStart" BIGINT,
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

UPDATE "SeriesConfig"
SET
  "code" = "series"::text,
  "rangeStart" = CASE "series"::text
    WHEN 'LOCK_TAGS' THEN 100000
    WHEN 'JEWELLERY_BARCODES' THEN 1000000000
    WHEN 'APPAREL_BARCODES' THEN 2000000000
    ELSE 1
  END,
  "displayName" = COALESCE(
    NULLIF(TRIM("displayName"), ''),
    CASE "series"::text
      WHEN 'LOCK_TAGS' THEN 'Lock Tags'
      WHEN 'JEWELLERY_BARCODES' THEN 'Jewellery Barcodes'
      WHEN 'APPAREL_BARCODES' THEN 'Apparel Barcodes'
      ELSE "series"::text
    END
  ),
  "prefixPattern" = COALESCE(
    NULLIF(TRIM("prefixPattern"), ''),
    CASE "series"::text
      WHEN 'LOCK_TAGS' THEN '000XXXXXXX'
      WHEN 'JEWELLERY_BARCODES' THEN '1XXXXXXXXX'
      WHEN 'APPAREL_BARCODES' THEN '2XXXXXXXXX'
      ELSE 'XXXXXXXXXX'
    END
  ),
  "sortOrder" = CASE "series"::text
    WHEN 'LOCK_TAGS' THEN 0
    WHEN 'JEWELLERY_BARCODES' THEN 1
    WHEN 'APPAREL_BARCODES' THEN 2
    ELSE 99
  END;

-- SerialReservation: enum -> text code
ALTER TABLE "SerialReservation" ADD COLUMN IF NOT EXISTS "series_text" TEXT;
UPDATE "SerialReservation" SET "series_text" = "series"::text;
ALTER TABLE "SerialReservation" DROP COLUMN "series";
ALTER TABLE "SerialReservation" RENAME COLUMN "series_text" TO "series";
ALTER TABLE "SerialReservation" ALTER COLUMN "series" SET NOT NULL;

-- Subcategory: optional enum -> text code
ALTER TABLE "Subcategory" ADD COLUMN IF NOT EXISTS "series_text" TEXT;
UPDATE "Subcategory" SET "series_text" = "series"::text WHERE "series" IS NOT NULL;
ALTER TABLE "Subcategory" DROP COLUMN "series";
ALTER TABLE "Subcategory" RENAME COLUMN "series_text" TO "series";

-- SeriesConfig: drop enum column, finalize code as primary identifier
ALTER TABLE "SeriesConfig" DROP CONSTRAINT IF EXISTS "SeriesConfig_series_key";
ALTER TABLE "SeriesConfig" DROP COLUMN "series";

ALTER TABLE "SeriesConfig" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "SeriesConfig" ALTER COLUMN "displayName" SET NOT NULL;
ALTER TABLE "SeriesConfig" ALTER COLUMN "prefixPattern" SET NOT NULL;
ALTER TABLE "SeriesConfig" ALTER COLUMN "rangeStart" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "SeriesConfig_code_key" ON "SeriesConfig"("code");
CREATE INDEX IF NOT EXISTS "SeriesConfig_isActive_sortOrder_idx" ON "SeriesConfig"("isActive", "sortOrder");

ALTER TABLE "SerialReservation"
  ADD CONSTRAINT "SerialReservation_series_fkey"
  FOREIGN KEY ("series") REFERENCES "SeriesConfig"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Subcategory"
  ADD CONSTRAINT "Subcategory_series_fkey"
  FOREIGN KEY ("series") REFERENCES "SeriesConfig"("code") ON DELETE SET NULL ON UPDATE CASCADE;

DROP TYPE IF EXISTS "SerialSeries";

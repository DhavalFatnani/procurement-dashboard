-- Jewellery/Apparel series start at 1B/2B; legacy seed used ceiling 9_000_000.
UPDATE "SeriesConfig"
SET "ceilingNumber" = 9999999999,
    "updatedAt" = NOW()
WHERE series IN ('JEWELLERY_BARCODES', 'APPAREL_BARCODES')
  AND "ceilingNumber" < 1000000000;

UPDATE "SeriesConfig"
SET "ceilingNumber" = 9999999,
    "updatedAt" = NOW()
WHERE series = 'LOCK_TAGS'
  AND "ceilingNumber" < 100000;

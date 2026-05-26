-- Remove reservations outside each series' numeric band:
--   LOCK_TAGS:          100000 .. 9999999        (000… prefix, vendor)
--   JEWELLERY_BARCODES: 1000000000 .. 9999999999 (1… prefix, internal print)
--   APPAREL_BARCODES:   2000000000 .. 9999999999 (2… prefix, internal print)

DELETE FROM "SerialReservation"
WHERE (
  series = 'JEWELLERY_BARCODES'
  AND ("rangeStart" < 1000000000 OR "rangeEnd" < 1000000000 OR "rangeEnd" > 9999999999)
)
OR (
  series = 'APPAREL_BARCODES'
  AND ("rangeStart" < 2000000000 OR "rangeEnd" < 2000000000 OR "rangeEnd" > 9999999999)
)
OR (
  series = 'LOCK_TAGS'
  AND ("rangeStart" < 100000 OR "rangeEnd" < 100000 OR "rangeEnd" > 9999999 OR "rangeStart" >= 1000000000)
);

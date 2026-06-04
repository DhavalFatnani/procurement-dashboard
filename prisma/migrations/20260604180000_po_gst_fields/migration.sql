-- Purchase order GST basis (rates are exclusive; GST added on top when applicable).

ALTER TABLE "PurchaseOrder" ADD COLUMN "gstApplicable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PurchaseOrder" ADD COLUMN "gstRatePercent" DECIMAL(5,2);

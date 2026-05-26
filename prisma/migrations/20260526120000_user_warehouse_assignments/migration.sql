-- Multi-warehouse assignments for Ops Head and Finance users.
CREATE TABLE "UserWarehouse" (
    "userId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,

    CONSTRAINT "UserWarehouse_pkey" PRIMARY KEY ("userId","warehouseId")
);

CREATE INDEX "UserWarehouse_warehouseId_idx" ON "UserWarehouse"("warehouseId");

ALTER TABLE "UserWarehouse" ADD CONSTRAINT "UserWarehouse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserWarehouse" ADD CONSTRAINT "UserWarehouse_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from each user's primary warehouse.
INSERT INTO "UserWarehouse" ("userId", "warehouseId")
SELECT "id", "warehouseId" FROM "User"
ON CONFLICT DO NOTHING;

-- Label template storage: org default, series overrides, print-time overrides

-- CreateTable
CREATE TABLE "LabelTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabelTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "defaultLabelTemplateId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgSettings_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "SeriesConfig" ADD COLUMN "labelTemplateId" TEXT;

-- AlterTable
ALTER TABLE "SerialReservation" ADD COLUMN "printTimeLabelOverride" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "OrgSettings_defaultLabelTemplateId_key" ON "OrgSettings"("defaultLabelTemplateId");

-- CreateIndex
CREATE INDEX "LabelTemplate_createdById_idx" ON "LabelTemplate"("createdById");

-- CreateIndex
CREATE INDEX "SeriesConfig_labelTemplateId_idx" ON "SeriesConfig"("labelTemplateId");

-- AddForeignKey
ALTER TABLE "SeriesConfig" ADD CONSTRAINT "SeriesConfig_labelTemplateId_fkey" FOREIGN KEY ("labelTemplateId") REFERENCES "LabelTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabelTemplate" ADD CONSTRAINT "LabelTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgSettings" ADD CONSTRAINT "OrgSettings_defaultLabelTemplateId_fkey" FOREIGN KEY ("defaultLabelTemplateId") REFERENCES "LabelTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed singleton org settings row
INSERT INTO "OrgSettings" ("id", "updatedAt") VALUES ('singleton', CURRENT_TIMESTAMP);

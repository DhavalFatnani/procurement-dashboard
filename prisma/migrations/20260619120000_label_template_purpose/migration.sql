-- CreateEnum
CREATE TYPE "LabelTemplatePurpose" AS ENUM ('SERIAL', 'BIN');

-- AlterTable
ALTER TABLE "LabelTemplate" ADD COLUMN "description" TEXT,
ADD COLUMN "purpose" "LabelTemplatePurpose" NOT NULL DEFAULT 'SERIAL';

-- AlterTable
ALTER TABLE "OrgSettings" ADD COLUMN "defaultBinLabelTemplateId" TEXT;

-- CreateIndex
CREATE INDEX "LabelTemplate_purpose_idx" ON "LabelTemplate"("purpose");

-- CreateIndex
CREATE UNIQUE INDEX "OrgSettings_defaultBinLabelTemplateId_key" ON "OrgSettings"("defaultBinLabelTemplateId");

-- AddForeignKey
ALTER TABLE "OrgSettings" ADD CONSTRAINT "OrgSettings_defaultBinLabelTemplateId_fkey" FOREIGN KEY ("defaultBinLabelTemplateId") REFERENCES "LabelTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

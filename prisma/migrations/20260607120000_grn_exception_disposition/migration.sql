-- CreateEnum
CREATE TYPE "GRNExceptionDisposition" AS ENUM ('KEEP', 'RETURN_TO_VENDOR', 'NOT_RETURNED');

-- AlterTable
ALTER TABLE "GRNException" ADD COLUMN "resolutionDisposition" "GRNExceptionDisposition",
ADD COLUMN "closeLineAfterResolve" BOOLEAN;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FieldType" ADD VALUE 'ADDRESS';
ALTER TYPE "FieldType" ADD VALUE 'RATING';
ALTER TYPE "FieldType" ADD VALUE 'SIGNATURE';
ALTER TYPE "FieldType" ADD VALUE 'DIVIDER';
ALTER TYPE "FieldType" ADD VALUE 'HEADING';
ALTER TYPE "FieldType" ADD VALUE 'HTML_BLOCK';
ALTER TYPE "FieldType" ADD VALUE 'HIDDEN';
ALTER TYPE "FieldType" ADD VALUE 'RICH_TEXT';
ALTER TYPE "FieldType" ADD VALUE 'CALCULATION';

-- AlterTable
ALTER TABLE "Form" ADD COLUMN     "productCode" TEXT;

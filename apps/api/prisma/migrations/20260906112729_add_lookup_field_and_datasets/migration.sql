-- AlterEnum
ALTER TYPE "FieldType" ADD VALUE 'LOOKUP';

-- AlterTable
ALTER TABLE "Form" ADD COLUMN     "lookupDatasets" JSONB NOT NULL DEFAULT '[]';

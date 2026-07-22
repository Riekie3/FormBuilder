-- CreateEnum
CREATE TYPE "ResponseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Form" ADD COLUMN     "approverRoleId" TEXT,
ADD COLUMN     "requiresApproval" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Response" ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "decidedByUserId" TEXT,
ADD COLUMN     "decisionComment" TEXT,
ADD COLUMN     "status" "ResponseStatus";

-- CreateIndex
CREATE INDEX "Form_approverRoleId_idx" ON "Form"("approverRoleId");

-- CreateIndex
CREATE INDEX "Response_status_idx" ON "Response"("status");

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_approverRoleId_fkey" FOREIGN KEY ("approverRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

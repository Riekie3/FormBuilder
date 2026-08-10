-- CreateTable
CREATE TABLE "DraftResponse" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DraftResponse_token_key" ON "DraftResponse"("token");

-- CreateIndex
CREATE INDEX "DraftResponse_formId_idx" ON "DraftResponse"("formId");

-- AddForeignKey
ALTER TABLE "DraftResponse" ADD CONSTRAINT "DraftResponse_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

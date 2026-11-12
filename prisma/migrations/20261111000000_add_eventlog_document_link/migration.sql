-- AlterTable: add document-level link to event_logs for per-document history timeline
ALTER TABLE "event_logs" ADD COLUMN "document_type" TEXT,
ADD COLUMN "document_id" INTEGER;

-- CreateIndex
CREATE INDEX "event_logs_document_type_document_id_idx" ON "event_logs"("document_type", "document_id");

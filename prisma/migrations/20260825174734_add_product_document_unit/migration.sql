-- AlterTable
ALTER TABLE "product_masters" ADD COLUMN "document_unit_id" INTEGER;

-- AddForeignKey
ALTER TABLE "product_masters" ADD CONSTRAINT "product_masters_document_unit_id_fkey" FOREIGN KEY ("document_unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

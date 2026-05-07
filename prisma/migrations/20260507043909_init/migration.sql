-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'WAREHOUSE', 'MARKETING');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('PENDING_LINK', 'IN_STOCK', 'PENDING_OUT', 'SHIPPED', 'ACTIVATED', 'RETURNED', 'DAMAGED', 'BORROWED', 'SCRAPPED');

-- CreateEnum
CREATE TYPE "BorrowStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RETURNED');

-- CreateEnum
CREATE TYPE "QRTokenStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "OutboundStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ActivationType" AS ENUM ('SINGLE', 'PACK');

-- CreateEnum
CREATE TYPE "GRNReceivingStatus" AS ENUM ('PARTIAL', 'COMPLETE');

-- CreateEnum
CREATE TYPE "DamagedActionType" AS ENUM ('RESTORE', 'SCRAP');

-- CreateEnum
CREATE TYPE "DamagedActionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "POStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PARTIAL', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DamagedClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "product_masters" (
    "id" SERIAL NOT NULL,
    "sku" TEXT NOT NULL,
    "serial_code" CHAR(5) NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT,
    "image_url" TEXT,
    "category_id" INTEGER NOT NULL,
    "model_size" TEXT,
    "description" TEXT,
    "default_unit_id" INTEGER,
    "activation_type" "ActivationType" NOT NULL DEFAULT 'SINGLE',
    "max_activations" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" SERIAL NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT,
    "serial_code" CHAR(1) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" SERIAL NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_methods" (
    "id" SERIAL NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "force_pw_change" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinics" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "company_name" TEXT,
    "province" TEXT NOT NULL,
    "branch_name" TEXT,
    "invoice_name" TEXT,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_items" (
    "id" SERIAL NOT NULL,
    "serial12" VARCHAR(20) NOT NULL,
    "product_master_id" INTEGER,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" INTEGER NOT NULL,
    "model_size" TEXT,
    "lot" TEXT,
    "mfg_date" DATE,
    "exp_date" DATE,
    "status" "ProductStatus" NOT NULL DEFAULT 'IN_STOCK',
    "activation_count" INTEGER NOT NULL DEFAULT 0,
    "assigned_clinic_id" INTEGER,
    "pre_generated_batch_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_tokens" (
    "id" SERIAL NOT NULL,
    "product_item_id" INTEGER NOT NULL,
    "token_version" INTEGER NOT NULL DEFAULT 1,
    "token" TEXT,
    "token_hash" TEXT NOT NULL,
    "status" "QRTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "revoke_reason" TEXT,

    CONSTRAINT "qr_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grn_headers" (
    "id" SERIAL NOT NULL,
    "grn_no" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "received_by_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "po_no" TEXT,
    "supplier_name" TEXT NOT NULL,
    "delivery_note_no" TEXT,
    "supplier_address" TEXT,
    "supplier_phone" TEXT,
    "supplier_contact" TEXT,
    "delivery_doc_date" TIMESTAMP(3),
    "approved_by_id" INTEGER,
    "approved_at" TIMESTAMP(3),
    "rejected_by_id" INTEGER,
    "rejected_at" TIMESTAMP(3),
    "reject_reason" TEXT,
    "remarks" TEXT,
    "receiving_status" "GRNReceivingStatus" NOT NULL DEFAULT 'COMPLETE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grn_headers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grn_lines" (
    "id" SERIAL NOT NULL,
    "grn_header_id" INTEGER NOT NULL,
    "product_item_id" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "model_size" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_id" INTEGER NOT NULL,
    "lot" TEXT,
    "mfg_date" DATE,
    "exp_date" DATE,
    "remarks" TEXT,
    "receiving_session_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grn_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grn_plan_lines" (
    "id" SERIAL NOT NULL,
    "grn_header_id" INTEGER NOT NULL,
    "product_master_id" INTEGER NOT NULL,
    "total_qty" INTEGER NOT NULL,
    "received_qty" INTEGER NOT NULL DEFAULT 0,
    "unit_id" INTEGER NOT NULL,
    "lot" TEXT,
    "mfg_date" DATE,
    "exp_date" DATE,
    "remarks" TEXT,
    "discrepancy_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grn_plan_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grn_receiving_sessions" (
    "id" SERIAL NOT NULL,
    "grn_header_id" INTEGER NOT NULL,
    "session_no" INTEGER NOT NULL,
    "received_by_id" INTEGER NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "item_count" INTEGER NOT NULL,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grn_receiving_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_headers" (
    "id" SERIAL NOT NULL,
    "delivery_note_no" TEXT NOT NULL,
    "contract_no" TEXT,
    "shipped_at" TIMESTAMP(3),
    "created_by_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "shipping_method_id" INTEGER NOT NULL,
    "sales_person_name" TEXT,
    "company_contact" TEXT,
    "clinic_id" INTEGER NOT NULL,
    "clinic_address" TEXT,
    "clinic_phone" TEXT,
    "clinic_email" TEXT,
    "clinic_contact_name" TEXT,
    "purchase_order_id" INTEGER,
    "status" "OutboundStatus" NOT NULL DEFAULT 'DRAFT',
    "approved_by_id" INTEGER,
    "approved_at" TIMESTAMP(3),
    "reject_reason" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_headers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_lines" (
    "id" SERIAL NOT NULL,
    "outbound_id" INTEGER NOT NULL,
    "product_item_id" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "model_size" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_id" INTEGER NOT NULL,
    "lot" TEXT,
    "exp_date" DATE,
    "item_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbound_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activations" (
    "id" SERIAL NOT NULL,
    "product_item_id" INTEGER NOT NULL,
    "activation_number" INTEGER NOT NULL DEFAULT 1,
    "customer_name" TEXT,
    "age" INTEGER,
    "gender" TEXT,
    "province" TEXT,
    "phone" TEXT,
    "income" TEXT,
    "discovery_channel" TEXT,
    "consent_at" TIMESTAMP(3) NOT NULL,
    "policy_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_logs" (
    "id" SERIAL NOT NULL,
    "product_item_id" INTEGER NOT NULL,
    "qr_token_id" INTEGER,
    "token_version" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_logs" (
    "id" SERIAL NOT NULL,
    "event_type" TEXT NOT NULL,
    "product_item_id" INTEGER,
    "user_id" INTEGER,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequence_counters" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "current_val" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "sequence_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pre_generated_batches" (
    "id" SERIAL NOT NULL,
    "batch_no" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "linked_count" INTEGER NOT NULL DEFAULT 0,
    "print_count" INTEGER NOT NULL DEFAULT 0,
    "last_printed_at" TIMESTAMP(3),
    "product_master_id" INTEGER NOT NULL,
    "created_by_id" INTEGER NOT NULL,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pre_generated_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pre_generated_batch_print_logs" (
    "id" SERIAL NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "layout" TEXT NOT NULL,
    "is_reprint" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pre_generated_batch_print_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" SERIAL NOT NULL,
    "po_no" TEXT NOT NULL,
    "clinic_id" INTEGER NOT NULL,
    "status" "POStatus" NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "delivery_note_no" TEXT,
    "contract_no" TEXT,
    "sales_person_name" TEXT,
    "company_contact" TEXT,
    "clinic_address" TEXT,
    "clinic_phone" TEXT,
    "clinic_email" TEXT,
    "clinic_contact_name" TEXT,
    "billing_name" TEXT,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_lines" (
    "id" SERIAL NOT NULL,
    "purchase_order_id" INTEGER NOT NULL,
    "product_master_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "shipped_quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrow_transactions" (
    "id" SERIAL NOT NULL,
    "transaction_no" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "BorrowStatus" NOT NULL DEFAULT 'PENDING',
    "borrower_name" TEXT NOT NULL,
    "clinic_name" TEXT,
    "clinic_address" TEXT,
    "tax_invoice_ref" TEXT,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "reason" TEXT,
    "remarks" TEXT,
    "created_by_id" INTEGER NOT NULL,
    "approved_by_id" INTEGER,
    "approved_at" TIMESTAMP(3),
    "rejected_by_id" INTEGER,
    "rejected_at" TIMESTAMP(3),
    "rejected_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "borrow_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrow_transaction_lines" (
    "id" SERIAL NOT NULL,
    "borrow_transaction_id" INTEGER NOT NULL,
    "product_item_id" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "model_size" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_id" INTEGER NOT NULL,
    "lot" TEXT,
    "exp_date" DATE,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "borrow_transaction_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "damaged_action_requests" (
    "id" SERIAL NOT NULL,
    "product_item_id" INTEGER NOT NULL,
    "action_type" "DamagedActionType" NOT NULL,
    "status" "DamagedActionStatus" NOT NULL DEFAULT 'PENDING',
    "repair_note" TEXT,
    "replacement_item_id" INTEGER,
    "created_by_id" INTEGER NOT NULL,
    "approved_by_id" INTEGER,
    "approved_at" TIMESTAMP(3),
    "reject_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "damaged_action_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "damaged_claims" (
    "id" SERIAL NOT NULL,
    "claim_number" TEXT NOT NULL,
    "clinic_id" INTEGER NOT NULL,
    "product_master_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "status" "DamagedClaimStatus" NOT NULL DEFAULT 'PENDING',
    "created_by_id" INTEGER NOT NULL,
    "approved_by_id" INTEGER,
    "approved_at" TIMESTAMP(3),
    "reject_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "damaged_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "damaged_claim_attachments" (
    "id" SERIAL NOT NULL,
    "claim_id" INTEGER NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "damaged_claim_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_masters_sku_key" ON "product_masters"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_masters_serial_code_key" ON "product_masters"("serial_code");

-- CreateIndex
CREATE INDEX "product_masters_sku_idx" ON "product_masters"("sku");

-- CreateIndex
CREATE INDEX "product_masters_is_active_idx" ON "product_masters"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_serial_code_key" ON "product_categories"("serial_code");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "product_items_serial12_key" ON "product_items"("serial12");

-- CreateIndex
CREATE INDEX "product_items_serial12_idx" ON "product_items"("serial12");

-- CreateIndex
CREATE INDEX "product_items_status_idx" ON "product_items"("status");

-- CreateIndex
CREATE INDEX "product_items_product_master_id_idx" ON "product_items"("product_master_id");

-- CreateIndex
CREATE INDEX "product_items_pre_generated_batch_id_idx" ON "product_items"("pre_generated_batch_id");

-- CreateIndex
CREATE INDEX "qr_tokens_token_hash_idx" ON "qr_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "qr_tokens_product_item_id_token_version_key" ON "qr_tokens"("product_item_id", "token_version");

-- CreateIndex
CREATE UNIQUE INDEX "grn_headers_grn_no_key" ON "grn_headers"("grn_no");

-- CreateIndex
CREATE UNIQUE INDEX "grn_lines_product_item_id_key" ON "grn_lines"("product_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "grn_receiving_sessions_grn_header_id_session_no_key" ON "grn_receiving_sessions"("grn_header_id", "session_no");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_headers_delivery_note_no_key" ON "outbound_headers"("delivery_note_no");

-- CreateIndex
CREATE INDEX "outbound_headers_purchase_order_id_idx" ON "outbound_headers"("purchase_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "activations_product_item_id_activation_number_key" ON "activations"("product_item_id", "activation_number");

-- CreateIndex
CREATE INDEX "scan_logs_scanned_at_idx" ON "scan_logs"("scanned_at");

-- CreateIndex
CREATE INDEX "event_logs_event_type_idx" ON "event_logs"("event_type");

-- CreateIndex
CREATE INDEX "event_logs_created_at_idx" ON "event_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sequence_counters_name_key" ON "sequence_counters"("name");

-- CreateIndex
CREATE UNIQUE INDEX "pre_generated_batches_batch_no_key" ON "pre_generated_batches"("batch_no");

-- CreateIndex
CREATE INDEX "pre_generated_batches_batch_no_idx" ON "pre_generated_batches"("batch_no");

-- CreateIndex
CREATE INDEX "pre_generated_batch_print_logs_batch_id_idx" ON "pre_generated_batch_print_logs"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_po_no_key" ON "purchase_orders"("po_no");

-- CreateIndex
CREATE INDEX "purchase_orders_clinic_id_idx" ON "purchase_orders"("clinic_id");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "borrow_transactions_transaction_no_key" ON "borrow_transactions"("transaction_no");

-- CreateIndex
CREATE INDEX "borrow_transactions_status_idx" ON "borrow_transactions"("status");

-- CreateIndex
CREATE INDEX "borrow_transactions_type_idx" ON "borrow_transactions"("type");

-- CreateIndex
CREATE INDEX "damaged_action_requests_status_idx" ON "damaged_action_requests"("status");

-- CreateIndex
CREATE INDEX "damaged_action_requests_product_item_id_idx" ON "damaged_action_requests"("product_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "damaged_claims_claim_number_key" ON "damaged_claims"("claim_number");

-- CreateIndex
CREATE INDEX "damaged_claims_status_idx" ON "damaged_claims"("status");

-- CreateIndex
CREATE INDEX "damaged_claims_clinic_id_idx" ON "damaged_claims"("clinic_id");

-- CreateIndex
CREATE INDEX "damaged_claim_attachments_claim_id_idx" ON "damaged_claim_attachments"("claim_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_user_id_endpoint_key" ON "push_subscriptions"("user_id", "endpoint");

-- AddForeignKey
ALTER TABLE "product_masters" ADD CONSTRAINT "product_masters_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_masters" ADD CONSTRAINT "product_masters_default_unit_id_fkey" FOREIGN KEY ("default_unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_items" ADD CONSTRAINT "product_items_product_master_id_fkey" FOREIGN KEY ("product_master_id") REFERENCES "product_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_items" ADD CONSTRAINT "product_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_items" ADD CONSTRAINT "product_items_assigned_clinic_id_fkey" FOREIGN KEY ("assigned_clinic_id") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_items" ADD CONSTRAINT "product_items_pre_generated_batch_id_fkey" FOREIGN KEY ("pre_generated_batch_id") REFERENCES "pre_generated_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_tokens" ADD CONSTRAINT "qr_tokens_product_item_id_fkey" FOREIGN KEY ("product_item_id") REFERENCES "product_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grn_headers" ADD CONSTRAINT "grn_headers_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grn_headers" ADD CONSTRAINT "grn_headers_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grn_headers" ADD CONSTRAINT "grn_headers_rejected_by_id_fkey" FOREIGN KEY ("rejected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grn_headers" ADD CONSTRAINT "grn_headers_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grn_lines" ADD CONSTRAINT "grn_lines_grn_header_id_fkey" FOREIGN KEY ("grn_header_id") REFERENCES "grn_headers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grn_lines" ADD CONSTRAINT "grn_lines_product_item_id_fkey" FOREIGN KEY ("product_item_id") REFERENCES "product_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grn_lines" ADD CONSTRAINT "grn_lines_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grn_lines" ADD CONSTRAINT "grn_lines_receiving_session_id_fkey" FOREIGN KEY ("receiving_session_id") REFERENCES "grn_receiving_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grn_plan_lines" ADD CONSTRAINT "grn_plan_lines_grn_header_id_fkey" FOREIGN KEY ("grn_header_id") REFERENCES "grn_headers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grn_plan_lines" ADD CONSTRAINT "grn_plan_lines_product_master_id_fkey" FOREIGN KEY ("product_master_id") REFERENCES "product_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grn_plan_lines" ADD CONSTRAINT "grn_plan_lines_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grn_receiving_sessions" ADD CONSTRAINT "grn_receiving_sessions_grn_header_id_fkey" FOREIGN KEY ("grn_header_id") REFERENCES "grn_headers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grn_receiving_sessions" ADD CONSTRAINT "grn_receiving_sessions_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_headers" ADD CONSTRAINT "outbound_headers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_headers" ADD CONSTRAINT "outbound_headers_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_headers" ADD CONSTRAINT "outbound_headers_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_headers" ADD CONSTRAINT "outbound_headers_shipping_method_id_fkey" FOREIGN KEY ("shipping_method_id") REFERENCES "shipping_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_headers" ADD CONSTRAINT "outbound_headers_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_headers" ADD CONSTRAINT "outbound_headers_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_lines" ADD CONSTRAINT "outbound_lines_outbound_id_fkey" FOREIGN KEY ("outbound_id") REFERENCES "outbound_headers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_lines" ADD CONSTRAINT "outbound_lines_product_item_id_fkey" FOREIGN KEY ("product_item_id") REFERENCES "product_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_lines" ADD CONSTRAINT "outbound_lines_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activations" ADD CONSTRAINT "activations_product_item_id_fkey" FOREIGN KEY ("product_item_id") REFERENCES "product_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_logs" ADD CONSTRAINT "scan_logs_product_item_id_fkey" FOREIGN KEY ("product_item_id") REFERENCES "product_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_logs" ADD CONSTRAINT "scan_logs_qr_token_id_fkey" FOREIGN KEY ("qr_token_id") REFERENCES "qr_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_product_item_id_fkey" FOREIGN KEY ("product_item_id") REFERENCES "product_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_generated_batches" ADD CONSTRAINT "pre_generated_batches_product_master_id_fkey" FOREIGN KEY ("product_master_id") REFERENCES "product_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_generated_batches" ADD CONSTRAINT "pre_generated_batches_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_generated_batch_print_logs" ADD CONSTRAINT "pre_generated_batch_print_logs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "pre_generated_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_generated_batch_print_logs" ADD CONSTRAINT "pre_generated_batch_print_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_product_master_id_fkey" FOREIGN KEY ("product_master_id") REFERENCES "product_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_transactions" ADD CONSTRAINT "borrow_transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_transactions" ADD CONSTRAINT "borrow_transactions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_transactions" ADD CONSTRAINT "borrow_transactions_rejected_by_id_fkey" FOREIGN KEY ("rejected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_transaction_lines" ADD CONSTRAINT "borrow_transaction_lines_borrow_transaction_id_fkey" FOREIGN KEY ("borrow_transaction_id") REFERENCES "borrow_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_transaction_lines" ADD CONSTRAINT "borrow_transaction_lines_product_item_id_fkey" FOREIGN KEY ("product_item_id") REFERENCES "product_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_transaction_lines" ADD CONSTRAINT "borrow_transaction_lines_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damaged_action_requests" ADD CONSTRAINT "damaged_action_requests_product_item_id_fkey" FOREIGN KEY ("product_item_id") REFERENCES "product_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damaged_action_requests" ADD CONSTRAINT "damaged_action_requests_replacement_item_id_fkey" FOREIGN KEY ("replacement_item_id") REFERENCES "product_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damaged_action_requests" ADD CONSTRAINT "damaged_action_requests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damaged_action_requests" ADD CONSTRAINT "damaged_action_requests_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damaged_claims" ADD CONSTRAINT "damaged_claims_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damaged_claims" ADD CONSTRAINT "damaged_claims_product_master_id_fkey" FOREIGN KEY ("product_master_id") REFERENCES "product_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damaged_claims" ADD CONSTRAINT "damaged_claims_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damaged_claims" ADD CONSTRAINT "damaged_claims_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damaged_claim_attachments" ADD CONSTRAINT "damaged_claim_attachments_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "damaged_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

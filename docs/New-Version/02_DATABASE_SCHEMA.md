# Database Schema Documentation
## QR Authenticity & Activation System v2.0

**Database:** PostgreSQL 15+
**ORM:** Prisma 6.19.2
**อัพเดตล่าสุด:** กุมภาพันธ์ 2026

---

## 1. Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MASTER DATA                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ProductCategory    Unit    ShippingMethod    Warehouse    ProductMaster   │
└────────┬────────────┬───────────┬──────────────┬─────────────────┬─────────┘
         │            │           │              │                 │
         ▼            ▼           ▼              ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CORE TABLES                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐   ┌───────────────┐   ┌─────────────────┐   ┌──────────────┐  │
│  │   User   │   │ ProductItem   │   │ PreGeneratedBatch│   │    Clinic    │  │
│  │          │   │ (serial12)    │   │                 │   │              │  │
│  └────┬─────┘   └───────┬───────┘   └────────┬────────┘   └──────┬───────┘  │
│       │                 │                    │                   │          │
│       │                 ▼                    │                   │          │
│       │         ┌───────────────┐            │                   │          │
│       │         │   QRToken     │←───────────┘                   │          │
│       │         └───────┬───────┘                                │          │
│       │                 │                                        │          │
│       │                 ▼                                        │          │
│       │         ┌───────────────┐                                │          │
│       │         │  Activation   │ (1:N สำหรับ PACK)               │          │
│       │         └───────────────┘                                │          │
└───────┼─────────────────────────────────────────────────────────┼──────────┘
        │                                                         │
        ▼                                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TRANSACTION TABLES                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  GRNHeader ←→ GRNLine ←→ ProductItem                                       │
│  OutboundHeader ←→ OutboundLine ←→ ProductItem                             │
│  PurchaseOrder ←→ PurchaseOrderLine ←→ ProductMaster                       │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LOG TABLES                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│          ScanLog (ประวัติการสแกน)    EventLog (ประวัติเหตุการณ์)             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Enums

### 2.1 UserRole
บทบาทผู้ใช้ระบบ

| Value | คำอธิบาย |
|-------|----------|
| `ADMIN` | ผู้ดูแลระบบ - จัดการทุกอย่าง |
| `MANAGER` | ผู้จัดการ - อนุมัติ Outbound |
| `WAREHOUSE` | พนักงานคลัง - รับ/ส่งสินค้า |

### 2.2 ProductStatus
สถานะสินค้า

| Value | คำอธิบาย |
|-------|----------|
| `PENDING_LINK` | QR ที่สร้างล่วงหน้า รอเชื่อมโยงกับสินค้า |
| `IN_STOCK` | อยู่ในคลัง พร้อมขาย |
| `PENDING_OUT` | รอส่งออก (รออนุมัติ) |
| `SHIPPED` | ส่งออกแล้ว |
| `ACTIVATED` | ลูกค้าเปิดใช้แล้ว |
| `RETURNED` | คืนสินค้า |
| `DAMAGED` | เสียหาย รอซ่อม |

### 2.3 QRTokenStatus
สถานะ QR Token

| Value | คำอธิบาย |
|-------|----------|
| `ACTIVE` | ใช้งานได้ |
| `REVOKED` | ถูกยกเลิก (พิมพ์ใหม่/คืนสินค้า) |

### 2.4 OutboundStatus
สถานะใบส่งออก

| Value | คำอธิบาย |
|-------|----------|
| `DRAFT` | ร่าง |
| `PENDING` | รออนุมัติ |
| `APPROVED` | อนุมัติแล้ว |
| `REJECTED` | ปฏิเสธ |

### 2.5 InspectionStatus
สถานะการตรวจรับ

| Value | คำอธิบาย |
|-------|----------|
| `OK` | ถูกต้องครบถ้วน |
| `DAMAGED` | เสียหาย |
| `CLAIM` | เคลม |
| `BROKEN` | แตก |
| `INCOMPLETE` | ไม่ครบ |

### 2.6 ActivationType (ใหม่)
ประเภทการ Activate

| Value | คำอธิบาย |
|-------|----------|
| `SINGLE` | Activate ได้ครั้งเดียว |
| `PACK` | Activate ได้หลายครั้ง (กำหนดจำนวน) |

### 2.7 POStatus (ใหม่)
สถานะใบสั่งซื้อ

| Value | คำอธิบาย |
|-------|----------|
| `DRAFT` | ร่าง |
| `CONFIRMED` | ยืนยันแล้ว |
| `PARTIAL` | ส่งบางส่วนแล้ว |
| `COMPLETED` | ส่งครบแล้ว |
| `CANCELLED` | ยกเลิก |

---

## 3. Master Data Tables

### 3.1 ProductMaster (ใหม่)
แคตาล็อกสินค้าหลัก

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัส |
| sku | VARCHAR | UNIQUE | รหัส SKU |
| name_th | VARCHAR | NOT NULL | ชื่อภาษาไทย |
| name_en | VARCHAR | NULL | ชื่อภาษาอังกฤษ |
| image_url | VARCHAR | NULL | URL รูปภาพ |
| category_id | INT | FK | หมวดหมู่ |
| model_size | VARCHAR | NULL | รุ่น/ขนาด |
| description | TEXT | NULL | รายละเอียด |
| default_unit_id | INT | FK, NULL | หน่วยนับเริ่มต้น |
| activation_type | ActivationType | DEFAULT SINGLE | ประเภท Activation |
| max_activations | INT | DEFAULT 1 | จำนวน Activation สูงสุด |
| is_active | BOOLEAN | DEFAULT true | สถานะใช้งาน |
| created_at | TIMESTAMP | DEFAULT now() | วันที่สร้าง |
| updated_at | TIMESTAMP | AUTO | วันที่แก้ไข |

**Indexes:** `sku`, `is_active`

### 3.2 ProductCategory
หมวดหมู่สินค้า

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัสหมวดหมู่ |
| name_th | VARCHAR | NOT NULL | ชื่อภาษาไทย |
| name_en | VARCHAR | NULL | ชื่อภาษาอังกฤษ |
| is_active | BOOLEAN | DEFAULT true | สถานะใช้งาน |
| created_at | TIMESTAMP | DEFAULT now() | วันที่สร้าง |
| updated_at | TIMESTAMP | AUTO | วันที่แก้ไข |

### 3.3 Unit
หน่วยนับ

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัสหน่วย |
| name_th | VARCHAR | NOT NULL | ชื่อภาษาไทย (ชิ้น, กล่อง) |
| name_en | VARCHAR | NULL | ชื่อภาษาอังกฤษ |
| is_active | BOOLEAN | DEFAULT true | สถานะใช้งาน |
| created_at | TIMESTAMP | DEFAULT now() | วันที่สร้าง |
| updated_at | TIMESTAMP | AUTO | วันที่แก้ไข |

### 3.4 ShippingMethod
วิธีการจัดส่ง

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัสวิธีจัดส่ง |
| name_th | VARCHAR | NOT NULL | ชื่อภาษาไทย |
| name_en | VARCHAR | NULL | ชื่อภาษาอังกฤษ |
| is_active | BOOLEAN | DEFAULT true | สถานะใช้งาน |
| created_at | TIMESTAMP | DEFAULT now() | วันที่สร้าง |
| updated_at | TIMESTAMP | AUTO | วันที่แก้ไข |

### 3.5 Warehouse
คลังสินค้า

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัสคลัง |
| name | VARCHAR | NOT NULL | ชื่อคลัง |
| is_active | BOOLEAN | DEFAULT true | สถานะใช้งาน |
| created_at | TIMESTAMP | DEFAULT now() | วันที่สร้าง |
| updated_at | TIMESTAMP | AUTO | วันที่แก้ไข |

---

## 4. Core Tables

### 4.1 User
ผู้ใช้ระบบ

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัสผู้ใช้ |
| username | VARCHAR | UNIQUE | ชื่อผู้ใช้ |
| password_hash | VARCHAR | NOT NULL | รหัสผ่าน (bcrypt) |
| display_name | VARCHAR | NOT NULL | ชื่อแสดง |
| role | UserRole | NOT NULL | บทบาท |
| is_active | BOOLEAN | DEFAULT true | สถานะใช้งาน |
| force_pw_change | BOOLEAN | DEFAULT false | บังคับเปลี่ยนรหัส |
| created_at | TIMESTAMP | DEFAULT now() | วันที่สร้าง |
| updated_at | TIMESTAMP | AUTO | วันที่แก้ไข |

**Relations:**
- `grnHeadersCreated` → GRNHeader (created by)
- `grnHeadersApproved` → GRNHeader (approved by)
- `grnHeadersRejected` → GRNHeader (rejected by)
- `outboundsCreated` → OutboundHeader (created by)
- `outboundsApproved` → OutboundHeader (approved by)
- `purchaseOrdersCreated` → PurchaseOrder (created by)
- `preGeneratedBatches` → PreGeneratedBatch (created by)
- `eventLogs` → EventLog

### 4.2 Clinic
คลินิก/ลูกค้า

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัสคลินิก |
| name | VARCHAR | NOT NULL | ชื่อคลินิก |
| province | VARCHAR | NOT NULL | จังหวัด |
| branch_name | VARCHAR | NULL | ชื่อสาขา |
| is_active | BOOLEAN | DEFAULT true | สถานะใช้งาน |
| created_at | TIMESTAMP | DEFAULT now() | วันที่สร้าง |
| updated_at | TIMESTAMP | AUTO | วันที่แก้ไข |

**Relations:**
- `products` → ProductItem[]
- `outbounds` → OutboundHeader[]
- `purchaseOrders` → PurchaseOrder[]

### 4.3 ProductItem ⭐ (Core)
สินค้า - ตารางหลักของระบบ

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัสสินค้า |
| **serial12** | CHAR(12) | **UNIQUE** | **Serial 12 หลัก** |
| product_master_id | INT | FK, NULL | อ้างอิง Product Master |
| sku | VARCHAR | NOT NULL | รหัส SKU |
| name | VARCHAR | NOT NULL | ชื่อสินค้า |
| category_id | INT | FK | หมวดหมู่ |
| model_size | VARCHAR | NULL | รุ่น/ขนาด/ปริมาณบรรจุ |
| lot | VARCHAR | NULL | Lot/Batch Number |
| mfg_date | DATE | NULL | วันผลิต |
| exp_date | DATE | NULL | วันหมดอายุ |
| status | ProductStatus | DEFAULT IN_STOCK | สถานะ |
| activation_count | INT | DEFAULT 0 | จำนวนครั้งที่ Activate แล้ว |
| assigned_clinic_id | INT | FK, NULL | คลินิกที่ส่งไป |
| pre_generated_batch_id | INT | FK, NULL | อ้างอิง Pre-Gen Batch |
| created_at | TIMESTAMP | DEFAULT now() | วันที่สร้าง |
| updated_at | TIMESTAMP | AUTO | วันที่แก้ไข |

**Indexes:** `serial12`, `status`, `product_master_id`, `pre_generated_batch_id`

**Relations:**
- `productMaster` → ProductMaster
- `category` → ProductCategory
- `assignedClinic` → Clinic
- `preGeneratedBatch` → PreGeneratedBatch
- `qrTokens` → QRToken[]
- `activations` → Activation[] (1:N สำหรับ PACK)
- `grnLine` → GRNLine (1:1)
- `outboundLines` → OutboundLine[]
- `scanLogs` → ScanLog[]
- `eventLogs` → EventLog[]

### 4.4 QRToken
QR Token - สำหรับยืนยันของแท้

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัส Token |
| product_item_id | INT | FK | สินค้า |
| token_version | INT | DEFAULT 1 | เวอร์ชัน (เพิ่มเมื่อพิมพ์ใหม่) |
| token | TEXT | NULL | Encrypted token (optional) |
| token_hash | VARCHAR | NOT NULL, INDEX | Hash สำหรับค้นหา |
| status | QRTokenStatus | DEFAULT ACTIVE | สถานะ |
| issued_at | TIMESTAMP | DEFAULT now() | วันออก Token |
| revoked_at | TIMESTAMP | NULL | วันยกเลิก |
| revoke_reason | VARCHAR | NULL | เหตุผลยกเลิก |

**Unique Constraint:** `(product_item_id, token_version)`

**Indexes:** `token_hash`

### 4.5 PreGeneratedBatch (ใหม่)
Batch ของ QR ที่สร้างล่วงหน้า

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัส Batch |
| batch_no | VARCHAR | UNIQUE | เลข Batch (PG-2026-000001) |
| quantity | INT | NOT NULL | จำนวนที่สร้าง |
| linked_count | INT | DEFAULT 0 | จำนวนที่เชื่อมโยงแล้ว |
| created_by_id | INT | FK | ผู้สร้าง |
| remarks | VARCHAR | NULL | หมายเหตุ |
| created_at | TIMESTAMP | DEFAULT now() | วันที่สร้าง |

**Indexes:** `batch_no`

---

## 5. Transaction Tables

### 5.1 GRNHeader
ใบรับสินค้า (Goods Received Note) - Header

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัส GRN |
| grn_no | VARCHAR | UNIQUE | เลขที่ GRN (GRN-2026-000001) |
| received_at | TIMESTAMP | NOT NULL | วันที่รับ |
| received_by_id | INT | FK | พนักงานตรวจรับ |
| warehouse_id | INT | FK | คลังสินค้า |
| po_no | VARCHAR | NULL | เลขที่ PO |
| supplier_name | VARCHAR | NOT NULL | ชื่อ Supplier |
| delivery_note_no | VARCHAR | NULL | เลขที่ใบส่งของ |
| supplier_address | VARCHAR | NULL | ที่อยู่ Supplier |
| supplier_phone | VARCHAR | NULL | เบอร์โทร |
| supplier_contact | VARCHAR | NULL | ชื่อผู้ติดต่อ |
| delivery_doc_date | DATE | NULL | วันที่เอกสารส่งของ |
| approved_by_id | INT | FK, NULL | ผู้อนุมัติ |
| approved_at | TIMESTAMP | NULL | วันที่อนุมัติ |
| rejected_by_id | INT | FK, NULL | ผู้ปฏิเสธ |
| rejected_at | TIMESTAMP | NULL | วันที่ปฏิเสธ |
| reject_reason | VARCHAR | NULL | เหตุผลปฏิเสธ |
| remarks | VARCHAR | NULL | หมายเหตุ |
| created_at | TIMESTAMP | DEFAULT now() | วันที่สร้าง |
| updated_at | TIMESTAMP | AUTO | วันที่แก้ไข |

### 5.2 GRNLine
ใบรับสินค้า - รายการ (1 Line = 1 Serial)

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัส Line |
| grn_header_id | INT | FK | Header |
| product_item_id | INT | FK, UNIQUE | สินค้า (1:1) |
| sku | VARCHAR | NOT NULL | รหัส SKU |
| item_name | VARCHAR | NOT NULL | ชื่อสินค้า |
| model_size | VARCHAR | NULL | รุ่น/ขนาด |
| quantity | INT | DEFAULT 1 | จำนวน |
| unit_id | INT | FK | หน่วยนับ |
| lot | VARCHAR | NULL | Lot Number |
| mfg_date | DATE | NULL | วันผลิต |
| exp_date | DATE | NULL | วันหมดอายุ |
| inspection_status | InspectionStatus | DEFAULT OK | สถานะตรวจรับ |
| remarks | VARCHAR | NULL | หมายเหตุ |
| created_at | TIMESTAMP | DEFAULT now() | วันที่สร้าง |

### 5.3 OutboundHeader
ใบส่งออก (Delivery Note) - Header

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัส Outbound |
| delivery_note_no | VARCHAR | UNIQUE | เลขที่ (OUT-2026-000001) |
| contract_no | VARCHAR | NULL | เลขที่สัญญา |
| shipped_at | TIMESTAMP | NULL | วันที่ส่ง |
| created_by_id | INT | FK | ผู้สร้าง |
| warehouse_id | INT | FK | คลังสินค้า |
| shipping_method_id | INT | FK | วิธีจัดส่ง |
| sales_person_name | VARCHAR | NULL | ชื่อ Sales |
| company_contact | VARCHAR | NULL | ข้อมูลติดต่อบริษัท |
| clinic_id | INT | FK | คลินิกปลายทาง |
| clinic_address | VARCHAR | NULL | ที่อยู่คลินิก |
| clinic_phone | VARCHAR | NULL | เบอร์โทรคลินิก |
| clinic_email | VARCHAR | NULL | Email คลินิก |
| clinic_contact_name | VARCHAR | NULL | ชื่อผู้ติดต่อคลินิก |
| purchase_order_id | INT | FK, NULL | อ้างอิง PO |
| status | OutboundStatus | DEFAULT DRAFT | สถานะ |
| approved_by_id | INT | FK, NULL | ผู้อนุมัติ |
| approved_at | TIMESTAMP | NULL | วันที่อนุมัติ |
| reject_reason | VARCHAR | NULL | เหตุผลปฏิเสธ |
| remarks | VARCHAR | NULL | หมายเหตุ |
| created_at | TIMESTAMP | DEFAULT now() | วันที่สร้าง |
| updated_at | TIMESTAMP | AUTO | วันที่แก้ไข |

**Indexes:** `purchase_order_id`

### 5.4 OutboundLine
ใบส่งออก - รายการ

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัส Line |
| outbound_id | INT | FK | Header |
| product_item_id | INT | FK | สินค้า |
| sku | VARCHAR | NOT NULL | รหัส SKU |
| item_name | VARCHAR | NOT NULL | ชื่อสินค้า |
| model_size | VARCHAR | NULL | รุ่น/ขนาด |
| quantity | INT | DEFAULT 1 | จำนวน |
| unit_id | INT | FK | หน่วยนับ |
| lot | VARCHAR | NULL | Lot Number |
| exp_date | DATE | NULL | วันหมดอายุ |
| item_status | VARCHAR | NULL | สภาพสินค้า |
| created_at | TIMESTAMP | DEFAULT now() | วันที่สร้าง |

### 5.5 PurchaseOrder (ใหม่)
ใบสั่งซื้อ

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัส PO |
| po_no | VARCHAR | UNIQUE | เลขที่ PO (PO-2026-000001) |
| clinic_id | INT | FK | คลินิก |
| status | POStatus | DEFAULT DRAFT | สถานะ |
| remarks | VARCHAR | NULL | หมายเหตุ |
| delivery_note_no | VARCHAR | NULL | IV No. |
| contract_no | VARCHAR | NULL | เลขที่สัญญา |
| sales_person_name | VARCHAR | NULL | ชื่อ Sales |
| company_contact | VARCHAR | NULL | ข้อมูลติดต่อ |
| clinic_address | VARCHAR | NULL | ที่อยู่คลินิก |
| clinic_phone | VARCHAR | NULL | เบอร์โทร |
| clinic_email | VARCHAR | NULL | Email |
| clinic_contact_name | VARCHAR | NULL | ชื่อผู้ติดต่อ |
| created_by_id | INT | FK | ผู้สร้าง |
| created_at | TIMESTAMP | DEFAULT now() | วันที่สร้าง |
| updated_at | TIMESTAMP | AUTO | วันที่แก้ไข |

**Indexes:** `clinic_id`, `status`

### 5.6 PurchaseOrderLine (ใหม่)
รายการใบสั่งซื้อ

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัส Line |
| purchase_order_id | INT | FK (CASCADE) | Header |
| product_master_id | INT | FK | Product Master |
| quantity | INT | NOT NULL | จำนวนที่สั่ง |
| shipped_quantity | INT | DEFAULT 0 | จำนวนที่ส่งแล้ว |
| created_at | TIMESTAMP | DEFAULT now() | วันที่สร้าง |

### 5.7 Activation
การเปิดใช้งานโดยลูกค้า

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัส Activation |
| product_item_id | INT | FK | สินค้า |
| activation_number | INT | DEFAULT 1 | ครั้งที่ activate (1, 2, 3...) |
| customer_name | VARCHAR | NULL | ชื่อลูกค้า (optional) |
| age | INT | NULL | อายุ (optional) |
| gender | VARCHAR | NULL | เพศ (optional) |
| province | VARCHAR | NULL | จังหวัด (optional) |
| phone | VARCHAR | NULL | เบอร์โทร |
| consent_at | TIMESTAMP | NOT NULL | วันที่ยินยอม PDPA |
| policy_version | VARCHAR | NOT NULL | เวอร์ชัน Policy |
| created_at | TIMESTAMP | DEFAULT now() | วันที่สร้าง |

**Unique Constraint:** `(product_item_id, activation_number)`

---

## 6. Log Tables

### 6.1 ScanLog
ประวัติการสแกน QR Code

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัส Log |
| product_item_id | INT | FK | สินค้า |
| qr_token_id | INT | FK, NULL | QR Token |
| token_version | INT | NOT NULL | เวอร์ชัน Token |
| result | VARCHAR | NOT NULL | ผลการสแกน |
| ip_hash | VARCHAR | NULL | Hash ของ IP (Privacy) |
| user_agent | VARCHAR | NULL | Browser/Device |
| scanned_at | TIMESTAMP | DEFAULT now() | เวลาสแกน |

**Indexes:** `scanned_at`

**Scan Results:**
- `GENUINE_IN_STOCK` - ของแท้ ยังอยู่ในคลัง
- `GENUINE_SHIPPED` - ของแท้ ส่งออกแล้ว
- `ACTIVATED` - ของแท้ เปิดใช้แล้ว
- `RETURNED` - สินค้าคืน
- `REPRINTED` - QR ถูกพิมพ์ใหม่
- `INVALID_TOKEN` - Token ไม่ถูกต้อง
- `NOT_FOUND` - ไม่พบสินค้า
- `REVOKED` - Token ถูกยกเลิก

### 6.2 EventLog
ประวัติเหตุการณ์ทั้งหมด

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัส Log |
| event_type | VARCHAR | NOT NULL | ประเภทเหตุการณ์ |
| product_item_id | INT | FK, NULL | สินค้า (ถ้ามี) |
| user_id | INT | FK, NULL | ผู้ใช้ (ถ้ามี) |
| details | JSON | NULL | รายละเอียดเพิ่มเติม |
| created_at | TIMESTAMP | DEFAULT now() | เวลา |

**Indexes:** `event_type`, `created_at`

**Event Types:**
- `INBOUND` - รับเข้าคลัง
- `OUTBOUND` - ส่งออก
- `APPROVE` - อนุมัติ
- `REJECT` - ปฏิเสธ
- `REPRINT` - พิมพ์ QR ใหม่
- `RETURN` - คืนสินค้า
- `ACTIVATE` - ลูกค้าเปิดใช้
- `PRE_GENERATE` - สร้าง QR ล่วงหน้า
- `LINK_PRODUCT` - เชื่อมโยง QR กับสินค้า

---

## 7. Utility Tables

### 7.1 SequenceCounter
ตัวนับรันนัมเบอร์อัตโนมัติ

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัส |
| name | VARCHAR | UNIQUE | ชื่อ Sequence |
| prefix | VARCHAR | NOT NULL | Prefix |
| current_val | BIGINT | DEFAULT 0 | ค่าปัจจุบัน |

**Sequences:**

| Name | Prefix Example | Output Example |
|------|---------------|----------------|
| `SERIAL` | - | 12 หลัก Random |
| `GRN` | GRN-2026- | GRN-2026-000001 |
| `OUTBOUND` | OUT-2026- | OUT-2026-000001 |
| `PO` | PO-2026- | PO-2026-000001 |
| `PRE_GEN` | PG-2026- | PG-2026-000001 |

### 7.2 SystemSetting (ใหม่)
การตั้งค่าระบบ

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัส |
| key | VARCHAR | UNIQUE | Key (e.g., "verify.showClinicInfo") |
| value | VARCHAR | NOT NULL | JSON string value |
| updated_at | TIMESTAMP | AUTO | วันที่แก้ไข |

**ตัวอย่าง Settings:**
- `verify.showClinicInfo` - แสดงข้อมูลคลินิกในหน้า verify
- `activation.requireCustomerInfo` - บังคับกรอกข้อมูลลูกค้า

---

## 8. การเปลี่ยนแปลงจากเวอร์ชันเดิม

### Tables ใหม่
1. **ProductMaster** - แคตาล็อกสินค้าหลัก
2. **PreGeneratedBatch** - Batch สำหรับ Pre-generate QR
3. **PurchaseOrder** - ใบสั่งซื้อ
4. **PurchaseOrderLine** - รายการใบสั่งซื้อ
5. **SystemSetting** - การตั้งค่าระบบ

### Enums ใหม่
1. **ActivationType** - SINGLE, PACK
2. **POStatus** - DRAFT, CONFIRMED, PARTIAL, COMPLETED, CANCELLED

### Fields ใหม่ใน ProductItem
- `product_master_id` - อ้างอิง Product Master
- `activation_count` - นับจำนวน activation (สำหรับ PACK)
- `pre_generated_batch_id` - อ้างอิง Pre-Gen Batch

### Fields ใหม่ใน ProductStatus
- `PENDING_LINK` - รอเชื่อมโยงกับสินค้า
- `DAMAGED` - สินค้าเสียหาย

### Fields ใหม่ใน Activation
- `activation_number` - ลำดับการ activation (สำหรับ PACK)
- ข้อมูลลูกค้าเป็น optional ทั้งหมด

### Fields ใหม่ใน OutboundHeader
- `contract_no` - เลขที่สัญญา
- `purchase_order_id` - อ้างอิง PO

---

## 9. Database Commands

```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database (dev)
npm run db:push

# Run migrations (production)
npm run db:migrate

# Seed database
npm run db:seed

# Open Prisma Studio
npm run db:studio

# Reset database
npm run db:reset
```

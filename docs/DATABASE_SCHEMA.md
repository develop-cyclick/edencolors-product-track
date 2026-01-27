# Database Schema Documentation

## QR Authenticity & Activation System

**Version:** 1.0
**Database:** PostgreSQL
**ORM:** Prisma

---

## สารบัญ

1. [ภาพรวมระบบ](#1-ภาพรวมระบบ)
2. [Entity Relationship Diagram](#2-entity-relationship-diagram)
3. [Enums](#3-enums)
4. [Master Data Tables](#4-master-data-tables)
5. [Core Tables](#5-core-tables)
6. [Transaction Tables](#6-transaction-tables)
7. [Log Tables](#7-log-tables)
8. [Utility Tables](#8-utility-tables)

---

## 1. ภาพรวมระบบ

ระบบติดตามและยืนยันความแท้ของสินค้าด้วย QR Code + Serial 12 หลัก

### Flow หลัก:
```
1. รับสินค้าเข้าคลัง (GRN) → สร้าง ProductItem + QR Token
2. ส่งออกสินค้า (Outbound) → เปลี่ยนสถานะ SHIPPED
3. ลูกค้าสแกน QR → ยืนยันของแท้ + เปิดใช้งาน (Activation)
```

### สถิติ Tables:
| ประเภท | จำนวน |
|--------|-------|
| Enums | 5 |
| Master Data | 4 |
| Core Tables | 4 |
| Transaction Tables | 5 |
| Log Tables | 2 |
| Utility Tables | 1 |
| **รวม** | **17 Tables** |

---

## 2. Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MASTER DATA                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  ProductCategory    Unit    ShippingMethod    Warehouse                      │
└────────┬────────────┬───────────┬─────────────────┬─────────────────────────┘
         │            │           │                 │
         ▼            │           │                 ▼
┌─────────────────────┼───────────┼─────────────────────────────────────────┐
│                     │    CORE TABLES                                       │
├─────────────────────┼───────────┼─────────────────────────────────────────┤
│                     │           │                                          │
│  ┌──────────┐       │           │    ┌──────────┐      ┌──────────┐       │
│  │   User   │───────┼───────────┼───►│ GRNHeader│◄────►│ GRNLine  │       │
│  │          │       │           │    └────┬─────┘      └────┬─────┘       │
│  │ ADMIN    │       │           │         │                 │             │
│  │ MANAGER  │       │           │         ▼                 ▼             │
│  │ WAREHOUSE│       │           │    ┌──────────────────────────┐         │
│  └────┬─────┘       │           │    │      ProductItem         │         │
│       │             │           │    │  (serial12 + QR Token)   │         │
│       │             │           │    └────────────┬─────────────┘         │
│       │             │           │                 │                        │
│       │             │           │    ┌────────────┼────────────┐          │
│       │             │           │    ▼            ▼            ▼          │
│       │             │           │ QRToken    Activation    Clinic         │
│       │             │           │                                          │
│       ▼             ▼           ▼                                          │
│  ┌──────────────────────────────────┐     ┌──────────────────────┐        │
│  │        OutboundHeader            │◄───►│    OutboundLine      │        │
│  └──────────────────────────────────┘     └──────────────────────┘        │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LOG TABLES                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│              ScanLog                          EventLog                       │
│         (ประวัติการสแกน)                   (ประวัติเหตุการณ์)                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Enums

### 3.1 UserRole
บทบาทผู้ใช้ระบบ

| Value | คำอธิบาย |
|-------|----------|
| `ADMIN` | ผู้ดูแลระบบ - จัดการทุกอย่าง |
| `MANAGER` | ผู้จัดการ - อนุมัติ GRN/Outbound |
| `WAREHOUSE` | พนักงานคลัง - รับ/ส่งสินค้า |

### 3.2 ProductStatus
สถานะสินค้า

| Value | คำอธิบาย |
|-------|----------|
| `IN_STOCK` | อยู่ในคลัง |
| `PENDING_OUT` | รอส่งออก (รออนุมัติ) |
| `SHIPPED` | ส่งออกแล้ว |
| `ACTIVATED` | ลูกค้าเปิดใช้แล้ว |
| `RETURNED` | คืนสินค้า |

### 3.3 QRTokenStatus
สถานะ QR Token

| Value | คำอธิบาย |
|-------|----------|
| `ACTIVE` | ใช้งานได้ |
| `REVOKED` | ถูกยกเลิก (พิมพ์ใหม่/คืนสินค้า) |

### 3.4 OutboundStatus
สถานะใบส่งออก

| Value | คำอธิบาย |
|-------|----------|
| `DRAFT` | ร่าง |
| `PENDING` | รออนุมัติ |
| `APPROVED` | อนุมัติแล้ว |
| `REJECTED` | ปฏิเสธ |

### 3.5 InspectionStatus
สถานะการตรวจรับ

| Value | คำอธิบาย |
|-------|----------|
| `OK` | ถูกต้องครบถ้วน |
| `DAMAGED` | เสียหาย |
| `CLAIM` | เคลม |
| `BROKEN` | แตก |
| `INCOMPLETE` | ไม่ครบ |

---

## 4. Master Data Tables

### 4.1 product_categories
หมวดหมู่สินค้า

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัสหมวดหมู่ |
| name_th | VARCHAR | NOT NULL | ชื่อภาษาไทย |
| name_en | VARCHAR | NULL | ชื่อภาษาอังกฤษ |
| is_active | BOOLEAN | DEFAULT true | สถานะใช้งาน |
| created_at | TIMESTAMP | DEFAULT now() | วันที่สร้าง |
| updated_at | TIMESTAMP | AUTO | วันที่แก้ไข |

### 4.2 units
หน่วยนับ

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัสหน่วย |
| name_th | VARCHAR | NOT NULL | ชื่อภาษาไทย (ชิ้น, กล่อง) |
| name_en | VARCHAR | NULL | ชื่อภาษาอังกฤษ |
| is_active | BOOLEAN | DEFAULT true | สถานะใช้งาน |
| created_at | TIMESTAMP | DEFAULT now() | วันที่สร้าง |
| updated_at | TIMESTAMP | AUTO | วันที่แก้ไข |

### 4.3 shipping_methods
วิธีการจัดส่ง

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัสวิธีจัดส่ง |
| name_th | VARCHAR | NOT NULL | ชื่อภาษาไทย |
| name_en | VARCHAR | NULL | ชื่อภาษาอังกฤษ |
| is_active | BOOLEAN | DEFAULT true | สถานะใช้งาน |
| created_at | TIMESTAMP | DEFAULT now() | วันที่สร้าง |
| updated_at | TIMESTAMP | AUTO | วันที่แก้ไข |

### 4.4 warehouses
คลังสินค้า

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัสคลัง |
| name | VARCHAR | NOT NULL | ชื่อคลัง |
| is_active | BOOLEAN | DEFAULT true | สถานะใช้งาน |
| created_at | TIMESTAMP | DEFAULT now() | วันที่สร้าง |
| updated_at | TIMESTAMP | AUTO | วันที่แก้ไข |

---

## 5. Core Tables

### 5.1 users
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
- `outboundsCreated` → OutboundHeader (created by)
- `outboundsApproved` → OutboundHeader (approved by)
- `eventLogs` → EventLog

### 5.2 clinics
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

### 5.3 product_items ⭐ (Core)
สินค้า - ตารางหลักของระบบ

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัสสินค้า |
| **serial12** | CHAR(12) | **UNIQUE** | **Serial 12 หลัก** |
| sku | VARCHAR | NOT NULL | รหัส SKU |
| name | VARCHAR | NOT NULL | ชื่อสินค้า |
| category_id | INT | FK | หมวดหมู่ |
| model_size | VARCHAR | NULL | รุ่น/ขนาด/ปริมาณบรรจุ |
| lot | VARCHAR | NULL | Lot/Batch Number |
| mfg_date | DATE | NULL | วันผลิต |
| exp_date | DATE | NULL | วันหมดอายุ |
| status | ProductStatus | DEFAULT IN_STOCK | สถานะ |
| assigned_clinic_id | INT | FK, NULL | คลินิกที่ส่งไป |
| created_at | TIMESTAMP | DEFAULT now() | วันที่สร้าง |
| updated_at | TIMESTAMP | AUTO | วันที่แก้ไข |

**Indexes:**
- `serial12` (สำหรับค้นหาเร็ว)
- `status` (สำหรับ filter)

**Relations:**
- `category` → ProductCategory
- `assignedClinic` → Clinic
- `qrTokens` → QRToken[]
- `activation` → Activation (1:1)
- `grnLine` → GRNLine (1:1)
- `outboundLines` → OutboundLine[]
- `scanLogs` → ScanLog[]
- `eventLogs` → EventLog[]

### 5.4 qr_tokens
QR Token - สำหรับยืนยันของแท้

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัส Token |
| product_item_id | INT | FK | สินค้า |
| token_version | INT | DEFAULT 1 | เวอร์ชัน (เพิ่มเมื่อพิมพ์ใหม่) |
| token | TEXT | NULL | Encrypted token |
| token_hash | VARCHAR | NOT NULL, INDEX | Hash สำหรับค้นหา |
| status | QRTokenStatus | DEFAULT ACTIVE | สถานะ |
| issued_at | TIMESTAMP | DEFAULT now() | วันออก Token |
| revoked_at | TIMESTAMP | NULL | วันยกเลิก |
| revoke_reason | VARCHAR | NULL | เหตุผลยกเลิก |

**Unique Constraint:** `(product_item_id, token_version)`

**Relations:**
- `productItem` → ProductItem
- `scanLogs` → ScanLog[]

---

## 6. Transaction Tables

### 6.1 grn_headers
ใบรับสินค้า (Goods Received Note) - Header

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัส GRN |
| **grn_no** | VARCHAR | **UNIQUE** | เลขที่ GRN (Auto: GRN-2026-000001) |
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

**Relations:**
- `receivedBy` → User
- `approvedBy` → User
- `rejectedBy` → User
- `warehouse` → Warehouse
- `lines` → GRNLine[]

### 6.2 grn_lines
ใบรับสินค้า - รายการ (1 Line = 1 Serial)

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัส Line |
| grn_header_id | INT | FK | Header |
| product_item_id | INT | FK, **UNIQUE** | สินค้า (1:1) |
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

### 6.3 outbound_headers
ใบส่งออก (Delivery Note) - Header

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัส Outbound |
| **delivery_note_no** | VARCHAR | **UNIQUE** | เลขที่ (Auto: OUT-2026-000001) |
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
| po_no | VARCHAR | NULL | เลขที่ PO |
| status | OutboundStatus | DEFAULT DRAFT | สถานะ |
| approved_by_id | INT | FK, NULL | ผู้อนุมัติ |
| approved_at | TIMESTAMP | NULL | วันที่อนุมัติ |
| reject_reason | VARCHAR | NULL | เหตุผลปฏิเสธ |
| remarks | VARCHAR | NULL | หมายเหตุ |
| created_at | TIMESTAMP | DEFAULT now() | วันที่สร้าง |
| updated_at | TIMESTAMP | AUTO | วันที่แก้ไข |

### 6.4 outbound_lines
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

### 6.5 activations
การเปิดใช้งานโดยลูกค้า

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัส Activation |
| product_item_id | INT | FK, **UNIQUE** | สินค้า (1:1) |
| customer_name | VARCHAR | NOT NULL | ชื่อลูกค้า |
| age | INT | NOT NULL | อายุ |
| gender | VARCHAR | NOT NULL | เพศ (M/F/Other) |
| province | VARCHAR | NOT NULL | จังหวัด |
| phone | VARCHAR | NULL | เบอร์โทร |
| consent_at | TIMESTAMP | NOT NULL | วันที่ยินยอม PDPA |
| policy_version | VARCHAR | NOT NULL | เวอร์ชัน Policy |
| created_at | TIMESTAMP | DEFAULT now() | วันที่สร้าง |

---

## 7. Log Tables

### 7.1 scan_logs
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

**Scan Results:**
- `GENUINE_IN_STOCK` - ของแท้ ยังอยู่ในคลัง
- `GENUINE_SHIPPED` - ของแท้ ส่งออกแล้ว
- `ACTIVATED` - ของแท้ เปิดใช้แล้ว
- `RETURNED` - สินค้าคืน
- `REPRINTED` - QR ถูกพิมพ์ใหม่
- `INVALID_TOKEN` - Token ไม่ถูกต้อง
- `NOT_FOUND` - ไม่พบสินค้า
- `REVOKED` - Token ถูกยกเลิก

**Indexes:** `scanned_at`

### 7.2 event_logs
ประวัติเหตุการณ์ทั้งหมด

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัส Log |
| event_type | VARCHAR | NOT NULL | ประเภทเหตุการณ์ |
| product_item_id | INT | FK, NULL | สินค้า (ถ้ามี) |
| user_id | INT | FK, NULL | ผู้ใช้ (ถ้ามี) |
| details | JSON | NULL | รายละเอียดเพิ่มเติม |
| created_at | TIMESTAMP | DEFAULT now() | เวลา |

**Event Types:**
- `INBOUND` - รับเข้าคลัง
- `OUTBOUND` - ส่งออก
- `APPROVE` - อนุมัติ
- `REJECT` - ปฏิเสธ
- `REPRINT` - พิมพ์ QR ใหม่
- `RETURN` - คืนสินค้า
- `ACTIVATE` - ลูกค้าเปิดใช้

**Indexes:** `event_type`, `created_at`

---

## 8. Utility Tables

### 8.1 sequence_counters
ตัวนับรันนัมเบอร์อัตโนมัติ

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| id | INT | PK, AUTO | รหัส |
| name | VARCHAR | UNIQUE | ชื่อ Sequence |
| prefix | VARCHAR | NOT NULL | Prefix (e.g., "GRN-2026-") |
| current_val | BIGINT | DEFAULT 0 | ค่าปัจจุบัน |

**Sequences:**
| Name | Prefix Example | Output Example |
|------|----------------|----------------|
| SERIAL | - | 12 หลัก Random |
| GRN | GRN-2026- | GRN-2026-000001 |
| OUTBOUND | OUT-2026- | OUT-2026-000001 |

---

## Appendix: SQL Create Statements

ใช้ Prisma migrate:

```bash
# Generate SQL
npx prisma migrate dev --name init

# Apply to database
npx prisma db push
```

---

## Appendix: Test Data (Seed)

หลัง seed จะได้ข้อมูลตัวอย่าง:

| Table | Records |
|-------|---------|
| Users | 3 (Admin, Manager, Warehouse) |
| ProductCategories | ตาม seed |
| Units | ตาม seed |
| ShippingMethods | ตาม seed |
| Warehouses | ตาม seed |
| Clinics | ตาม seed |

**Test Accounts:**

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin123 |
| Warehouse | warehouse1 | warehouse123 |
| Manager | manager1 | manager123 |

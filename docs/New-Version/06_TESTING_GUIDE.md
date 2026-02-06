# คู่มือการทดสอบระบบ (System Testing Guide)
## QR Authenticity & Activation System v2.0

**วัตถุประสงค์:** เอกสารนี้สำหรับ Demo ระบบให้ลูกค้าดู โดยครอบคลุมทุก Flow การทำงานหลัก
**อัพเดตล่าสุด:** กุมภาพันธ์ 2026

---

## สารบัญ

1. [ภาพรวม Flow การทดสอบ](#1-ภาพรวม-flow-การทดสอบ)
2. [เตรียมความพร้อมก่อนทดสอบ](#2-เตรียมความพร้อมก่อนทดสอบ)
3. [Test Case 1: สร้าง QR Code ล่วงหน้า](#3-test-case-1-สร้าง-qr-code-ล่วงหน้า-pre-generate)
4. [Test Case 2: รับสินค้าเข้าคลัง (GRN)](#4-test-case-2-รับสินค้าเข้าคลัง-grn)
5. [Test Case 3: สร้างใบสั่งซื้อ (Purchase Order)](#5-test-case-3-สร้างใบสั่งซื้อ-purchase-order)
6. [Test Case 4: สร้างใบส่งออก (Outbound)](#6-test-case-4-สร้างใบส่งออก-outbound)
7. [Test Case 5: Manager อนุมัติ/ปฏิเสธ](#7-test-case-5-manager-อนุมัติปฏิเสธ)
8. [Test Case 6: ตรวจสอบความแท้ (Verify)](#8-test-case-6-ตรวจสอบความแท้-verify)
9. [Test Case 7: ลงทะเบียนสินค้า (Activate)](#9-test-case-7-ลงทะเบียนสินค้า-activate)
10. [Test Case 8: พิมพ์ QR ใหม่ (Reprint)](#10-test-case-8-พิมพ์-qr-ใหม่-reprint)
11. [Test Case 9: รับคืนสินค้า (Return)](#11-test-case-9-รับคืนสินค้า-return)
12. [Test Case 10: สินค้าเสียหาย (Damaged)](#12-test-case-10-สินค้าเสียหาย-damaged)
13. [Test Case 11: ยืมสินค้า (Loan/Reservation)](#13-test-case-11-ยืมสินค้าสั่งฝาก-loanreservation)
14. [สรุป Data Flow ทั้งระบบ](#14-สรุป-data-flow-ทั้งระบบ)
15. [Checklist การทดสอบ](#15-checklist-การทดสอบ)

---

## 1. ภาพรวม Flow การทดสอบ

### Main Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    ADMIN SETUP                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐              │
│  │ Product      │   │   Clinic     │   │  Master      │   │   Users      │              │
│  │ Masters      │   │ Management   │   │   Data       │   │ Management   │              │
│  └──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘              │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 WAREHOUSE OPERATIONS                                     │
│                                                                                          │
│  ┌──────────────┐        ┌──────────────┐        ┌──────────────┐                       │
│  │ 1. Pre-Gen   │  ───▶  │ 2. GRN       │  ───▶  │ 4. Outbound  │                       │
│  │    QR Codes  │        │   (รับเข้า)    │        │   (ส่งออก)    │                       │
│  │              │        │              │        │              │                       │
│  │ PENDING_LINK │        │  IN_STOCK    │        │ PENDING_OUT  │                       │
│  └──────────────┘        └──────────────┘        └──────┬───────┘                       │
│                                 │                       │                               │
│                                 │                       │                               │
│                    ┌────────────┴────────────┐          │                               │
│                    │                         │          │                               │
│                    ▼                         ▼          │                               │
│           ┌──────────────┐          ┌──────────────┐    │                               │
│           │ 10. Damaged  │          │  8. Reprint  │    │                               │
│           │   (เสียหาย)   │          │  (พิมพ์ใหม่)  │    │                               │
│           │   DAMAGED    │          │ (version+1)  │    │                               │
│           └──────────────┘          └──────────────┘    │                               │
└─────────────────────────────────────────────────────────┼───────────────────────────────┘
                                                          │
                                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                  MANAGER APPROVAL                                        │
│                                                                                          │
│                              ┌──────────────┐                                           │
│                              │ 5. Approval  │                                           │
│                              │    Board     │                                           │
│                              └──────┬───────┘                                           │
│                         ┌───────────┴───────────┐                                       │
│                         │                       │                                       │
│                    [Approve]               [Reject]                                     │
│                         │                       │                                       │
│                         ▼                       ▼                                       │
│                   ┌──────────┐            ┌──────────┐                                  │
│                   │ SHIPPED  │            │ IN_STOCK │                                  │
│                   └────┬─────┘            └──────────┘                                  │
│                        │                                                                │
└────────────────────────┼────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   PUBLIC ACCESS                                          │
│                                                                                          │
│  ┌──────────────┐        ┌──────────────┐        ┌──────────────┐                       │
│  │ 6. Verify    │  ───▶  │ 7. Activate  │  ───▶  │  ACTIVATED   │                       │
│  │  (ตรวจสอบ)    │        │ (ลงทะเบียน)   │        │              │                       │
│  └──────────────┘        └──────────────┘        └──────┬───────┘                       │
│                                                         │                               │
│                                                         ▼                               │
│                                                  ┌──────────────┐                       │
│                                                  │ 9. Return    │                       │
│                                                  │   (คืนสินค้า)  │                       │
│                                                  │  RETURNED    │                       │
│                                                  └──────────────┘                       │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### บทบาทและสิทธิ์การเข้าถึง

| Role | สามารถทำได้ | ไม่สามารถทำได้ |
|------|-------------|----------------|
| **ADMIN** | ทุกอย่าง + จัดการ Users, Clinics, Masters, PO, Settings | - |
| **MANAGER** | ดู Dashboard + อนุมัติ/ปฏิเสธ Outbound | สร้าง GRN, Outbound |
| **WAREHOUSE** | Pre-gen, GRN, Outbound, Reprint, Return, Damaged | อนุมัติ Outbound, จัดการ Users |
| **PUBLIC** | Verify, Activate | ต้องไม่ Login |

---

## 2. เตรียมความพร้อมก่อนทดสอบ

### 2.1 Start ระบบ

```bash
# 1. Start Database
npm run db:up

# 2. Generate Prisma Client
npm run db:generate

# 3. Push Schema
npm run db:push

# 4. Seed Test Data
npm run db:seed

# 5. Start Development Server
npm run dev
```

### 2.2 บัญชีทดสอบ

| Role | Username | Password | URL Login |
|------|----------|----------|-----------|
| Admin | `admin` | `admin123` | `/th/login` |
| Warehouse | `warehouse1` | `warehouse123` | `/th/login` |
| Manager | `manager1` | `manager123` | `/th/login` |

### 2.3 ข้อมูล Master Data ที่ต้องมี (Seed แล้ว)

| ประเภท | ตัวอย่างข้อมูล |
|--------|---------------|
| **หมวดหมู่สินค้า** | ฟิลเลอร์, โบท็อกซ์, สกินแคร์ |
| **หน่วยนับ** | ชิ้น, กล่อง, ขวด |
| **วิธีจัดส่ง** | GRAB, ไปรษณีย์, Inter Express |
| **คลังสินค้า** | คลังกลาง |
| **คลินิก** | ABC Clinic (กรุงเทพ), XYZ Clinic (เชียงใหม่) |
| **Product Master** | FIL-001 Filler XYZ 1ml, BOT-001 Botox ABC |

---

## 3. Test Case 1: สร้าง QR Code ล่วงหน้า (Pre-Generate)

### วัตถุประสงค์
ทดสอบการสร้าง QR Code + Serial 12 หลักล่วงหน้า ก่อนรับสินค้าจริง

### ผู้ทดสอบ
**Role:** `WAREHOUSE` หรือ `ADMIN`

### ขั้นตอนการทดสอบ

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login ด้วย `warehouse1` / `warehouse123` | เข้า Dashboard สำเร็จ |
| 2 | คลิกเมนู **"สร้าง QR ล่วงหน้า"** | แสดงหน้า Pre-Generate |
| 3 | กรอก **จำนวน:** `5` | - |
| 4 | กรอก **หมายเหตุ:** `Batch ทดสอบสำหรับ Filler` | - |
| 5 | กดปุ่ม **"สร้าง QR"** | สร้าง Batch สำเร็จ |

### ผลลัพธ์ที่คาดหวัง

```
✅ สร้าง Batch เลขที่: PG-2026-000001
✅ สร้าง Serial 5 รายการ:
   - 123456789001 (PENDING_LINK)
   - 123456789002 (PENDING_LINK)
   - 123456789003 (PENDING_LINK)
   - 123456789004 (PENDING_LINK)
   - 123456789005 (PENDING_LINK)
```

### Data Flow

```
┌─────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  Warehouse  │────▶│ PreGeneratedBatch   │────▶│    ProductItem      │
│   (User)    │     │                     │     │                     │
└─────────────┘     │ id: 1               │     │ serial12: 123...001 │
                    │ batch_no: PG-2026-  │     │ status: PENDING_LINK│
                    │ quantity: 5         │     │ pre_gen_batch_id: 1 │
                    │ linked_count: 0     │     └─────────────────────┘
                    │ created_by_id: 2    │              │
                    └─────────────────────┘              ▼
                                                ┌─────────────────────┐
                                                │      QRToken        │
                                                │                     │
                                                │ product_item_id: 1  │
                                                │ token_version: 1    │
                                                │ token_hash: abc...  │
                                                │ status: ACTIVE      │
                                                └─────────────────────┘
```

### ตรวจสอบ Database

```sql
-- ตรวจสอบ Batch ที่สร้าง
SELECT * FROM "PreGeneratedBatch" ORDER BY id DESC LIMIT 1;

-- ตรวจสอบ ProductItem ที่สร้าง
SELECT serial12, status, pre_generated_batch_id
FROM "ProductItem"
WHERE pre_generated_batch_id IS NOT NULL;

-- ตรวจสอบ QRToken
SELECT pi.serial12, qt.token_version, qt.status
FROM "QRToken" qt
JOIN "ProductItem" pi ON qt.product_item_id = pi.id
WHERE pi.status = 'PENDING_LINK';
```

### พิมพ์ Label (Optional)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | เลือก Serial ที่ต้องการพิมพ์ | - |
| 2 | กดปุ่ม **"พิมพ์ Label"** | Download PDF |
| 3 | เปิด PDF | ขนาด 4x6 นิ้ว, มี QR + Serial |

---

## 4. Test Case 2: รับสินค้าเข้าคลัง (GRN)

### วัตถุประสงค์
ทดสอบการรับสินค้าเข้าคลัง โดยเชื่อมโยง QR จาก Pre-Generate กับข้อมูลสินค้าจริง

### ผู้ทดสอบ
**Role:** `WAREHOUSE` หรือ `ADMIN`

### ขั้นตอนการทดสอบ

#### Part A: สร้าง GRN Header

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | คลิกเมนู **"ใบรับเข้าคลัง"** | แสดงรายการ GRN |
| 2 | กดปุ่ม **"สร้างใหม่"** | แสดงฟอร์ม |
| 3 | กรอกข้อมูล Header: | |
| | - วันที่รับ: `วันนี้` | |
| | - คลัง: `คลังกลาง` | |
| | - เลข PO: `PO-TEST-001` | |
| | - ชื่อ Supplier: `บริษัท ABC จำกัด` | |
| | - เลขใบส่งของ: `DN-001` | |
| | - ที่อยู่: `123 ถนนสุขุมวิท กรุงเทพฯ` | |
| | - เบอร์โทร: `02-123-4567` | |
| | - ผู้ติดต่อ: `คุณสมชาย` | |

#### Part B: เพิ่มรายการสินค้า (3 วิธี)

**วิธีที่ 1: สแกน QR จาก Pre-Generate**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | กดปุ่ม **"สแกน QR"** | เปิดกล้อง |
| 2 | สแกน QR ที่พิมพ์จาก Pre-Gen | ดึงข้อมูล Serial มา |
| 3 | ระบบแสดง Serial: `123456789001` | สถานะ: PENDING_LINK |
| 4 | กรอกข้อมูลสินค้า: | |
| | - SKU: `FIL-001` | |
| | - ชื่อ: `Filler XYZ 1ml` | |
| | - หมวดหมู่: `ฟิลเลอร์` | |
| | - ขนาด: `1ml` | |
| | - Lot: `LOT2026001` | |
| | - วันผลิต: `2025-06-01` | |
| | - วันหมดอายุ: `2027-06-01` | |
| | - สถานะตรวจรับ: `OK` | |

**วิธีที่ 2: พิมพ์ Serial จาก Pre-Generate**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | กดปุ่ม **"เพิ่มรายการ"** | แสดงฟอร์มเปล่า |
| 2 | เลือก **"จาก Pre-Gen Batch"** | แสดง Dropdown |
| 3 | เลือก Batch: `PG-2026-000001` | แสดงรายการ Serial ที่ว่าง |
| 4 | เลือก Serial: `123456789002` | ดึงมาใส่ฟอร์ม |
| 5 | กรอกข้อมูลสินค้าเหมือนวิธีที่ 1 | |

**วิธีที่ 3: สร้าง Serial ใหม่ (ไม่ผ่าน Pre-Gen)**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | กดปุ่ม **"เพิ่มรายการ"** | แสดงฟอร์มเปล่า |
| 2 | เลือก **"สร้าง Serial ใหม่"** | ระบบจะ generate ให้ |
| 3 | กรอกข้อมูลสินค้า | |
| 4 | บันทึก | ระบบสร้าง Serial อัตโนมัติ |

#### Part C: บันทึก GRN

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | ตรวจสอบรายการทั้งหมด | 3 รายการ |
| 2 | กดปุ่ม **"บันทึก"** | บันทึกสำเร็จ |
| 3 | ระบบแสดงเลข GRN | `GRN-2026-000001` |

### ผลลัพธ์ที่คาดหวัง

```
✅ สร้าง GRN เลขที่: GRN-2026-000001
✅ สินค้า 3 รายการเปลี่ยนสถานะ:
   - 123456789001: PENDING_LINK → IN_STOCK
   - 123456789002: PENDING_LINK → IN_STOCK
   - 123456789003: (ใหม่) IN_STOCK
✅ PreGeneratedBatch.linked_count: 0 → 2
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    GRN Creation                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  Warehouse   │─────▶│   GRNHeader      │─────▶│    GRNLine       │
│    User      │      │                  │      │                  │
└──────────────┘      │ grn_no: GRN-2026 │      │ grn_header_id: 1 │
                      │ supplier: ABC    │      │ product_item_id:1│
                      │ warehouse_id: 1  │      │ sku: FIL-001     │
                      │ received_by: 2   │      │ lot: LOT2026001  │
                      └──────────────────┘      │ inspection: OK   │
                                                └────────┬─────────┘
                                                         │
                              ┌───────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              ProductItem Update                                      │
│                                                                                      │
│   ┌────────────────────────────────┐                                                │
│   │        ProductItem             │                                                │
│   │                                │                                                │
│   │  serial12: 123456789001        │                                                │
│   │  status: PENDING_LINK → IN_STOCK  ◀── สถานะเปลี่ยน                              │
│   │  sku: FIL-001                  │                                                │
│   │  name: Filler XYZ 1ml          │                                                │
│   │  lot: LOT2026001               │                                                │
│   │  exp_date: 2027-06-01          │                                                │
│   │  category_id: 1                │                                                │
│   │  pre_generated_batch_id: 1     │                                                │
│   └────────────────────────────────┘                                                │
│                                                                                      │
│   ┌────────────────────────────────┐                                                │
│   │     PreGeneratedBatch          │                                                │
│   │                                │                                                │
│   │  linked_count: 0 → 2  ◀── เพิ่มขึ้น                                              │
│   └────────────────────────────────┘                                                │
└─────────────────────────────────────────────────────────────────────────────────────┘

                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                EventLog Created                                      │
│                                                                                      │
│   event_type: INBOUND                                                               │
│   product_item_id: 1                                                                │
│   user_id: 2                                                                        │
│   details: { grnNo: "GRN-2026-000001", ... }                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### ตรวจสอบ Database

```sql
-- ตรวจสอบ GRN Header
SELECT * FROM "GRNHeader" ORDER BY id DESC LIMIT 1;

-- ตรวจสอบ GRN Lines
SELECT gl.*, pi.serial12, pi.status
FROM "GRNLine" gl
JOIN "ProductItem" pi ON gl.product_item_id = pi.id
WHERE gl.grn_header_id = 1;

-- ตรวจสอบ ProductItem ที่อัพเดต
SELECT serial12, status, sku, name, lot, exp_date
FROM "ProductItem"
WHERE status = 'IN_STOCK';

-- ตรวจสอบ linked_count
SELECT batch_no, quantity, linked_count
FROM "PreGeneratedBatch";

-- ตรวจสอบ EventLog
SELECT * FROM "EventLog" WHERE event_type = 'INBOUND' ORDER BY id DESC;
```

---

## 5. Test Case 3: สร้างใบสั่งซื้อ (Purchase Order)

### วัตถุประสงค์
ทดสอบการสร้างใบสั่งซื้อจากคลินิก (ระบบสั่งฝากสินค้า)

### ผู้ทดสอบ
**Role:** `ADMIN` เท่านั้น

### ขั้นตอนการทดสอบ

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login ด้วย `admin` / `admin123` | เข้า Dashboard |
| 2 | คลิกเมนู **"ใบสั่งซื้อ"** | แสดงรายการ PO |
| 3 | กดปุ่ม **"สร้างใหม่"** | แสดงฟอร์ม |
| 4 | กรอกข้อมูล: | |
| | - คลินิก: `ABC Clinic` | |
| | - Sales: `คุณนภา` | |
| | - เบอร์ติดต่อ: `081-234-5678` | |
| | - ที่อยู่คลินิก: `456 ถนนสีลม กรุงเทพฯ` | |
| | - หมายเหตุ: `สั่งฝากรอบ Q1` | |
| 5 | เพิ่มรายการสินค้า: | |
| | - Product Master: `FIL-001 Filler XYZ 1ml` | |
| | - จำนวน: `10` | |
| 6 | เพิ่มรายการอีก: | |
| | - Product Master: `BOT-001 Botox ABC` | |
| | - จำนวน: `5` | |
| 7 | กดปุ่ม **"บันทึกร่าง"** | บันทึกเป็น DRAFT |
| 8 | กดปุ่ม **"ยืนยัน PO"** | เปลี่ยนเป็น CONFIRMED |

### ผลลัพธ์ที่คาดหวัง

```
✅ สร้าง PO เลขที่: PO-2026-000001
✅ สถานะ: DRAFT → CONFIRMED
✅ รายการ:
   - FIL-001: สั่ง 10 ชิ้น, ส่งแล้ว 0
   - BOT-001: สั่ง 5 ชิ้น, ส่งแล้ว 0
```

### Data Flow

```
┌──────────────┐      ┌──────────────────────┐      ┌──────────────────────┐
│    Admin     │─────▶│    PurchaseOrder     │─────▶│  PurchaseOrderLine   │
│    User      │      │                      │      │                      │
└──────────────┘      │ po_no: PO-2026-0001  │      │ purchase_order_id: 1 │
                      │ clinic_id: 1         │      │ product_master_id: 1 │
                      │ status: CONFIRMED    │      │ quantity: 10         │
                      │ created_by_id: 1     │      │ shipped_quantity: 0  │
                      └──────────────────────┘      └──────────────────────┘
                                │
                                │ (เชื่อมกับ Outbound ภายหลัง)
                                ▼
                      ┌──────────────────────┐
                      │   OutboundHeader     │
                      │                      │
                      │ purchase_order_id: 1 │
                      └──────────────────────┘
```

### สถานะ PO

| สถานะ | ความหมาย | เงื่อนไข |
|-------|----------|---------|
| `DRAFT` | ร่าง | สร้างใหม่ |
| `CONFIRMED` | ยืนยันแล้ว | กดยืนยัน |
| `PARTIAL` | ส่งบางส่วน | shipped_quantity < quantity |
| `COMPLETED` | ส่งครบ | shipped_quantity = quantity (ทุก line) |
| `CANCELLED` | ยกเลิก | กดยกเลิก |

---

## 6. Test Case 4: สร้างใบส่งออก (Outbound)

### วัตถุประสงค์
ทดสอบการสร้างใบส่งออกสินค้าไปยังคลินิก

### ผู้ทดสอบ
**Role:** `WAREHOUSE` หรือ `ADMIN`

### ขั้นตอนการทดสอบ

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login ด้วย `warehouse1` | เข้า Dashboard |
| 2 | คลิกเมนู **"ใบส่งออก"** | แสดงรายการ |
| 3 | กดปุ่ม **"สร้างใหม่"** | แสดงฟอร์ม |
| 4 | กรอกข้อมูล Header: | |
| | - คลังต้นทาง: `คลังกลาง` | |
| | - คลินิกปลายทาง: `ABC Clinic` | |
| | - วิธีจัดส่ง: `GRAB` | |
| | - อ้างอิง PO: `PO-2026-000001` (ถ้ามี) | |
| | - เลขสัญญา: `CON-001` | |
| | - Sales: `คุณนภา` | |
| 5 | เลือกสินค้าที่จะส่ง: | |
| | (แสดงเฉพาะ IN_STOCK) | |
| | - ✅ `123456789001` - Filler XYZ 1ml | |
| | - ✅ `123456789002` - Filler XYZ 1ml | |
| 6 | กดปุ่ม **"บันทึกร่าง"** | สถานะ: DRAFT |
| 7 | กดปุ่ม **"ส่งขออนุมัติ"** | สถานะ: PENDING |

### ผลลัพธ์ที่คาดหวัง

```
✅ สร้าง Outbound เลขที่: OUT-2026-000001
✅ สถานะ: DRAFT → PENDING
✅ สินค้า 2 รายการเปลี่ยนสถานะ:
   - 123456789001: IN_STOCK → PENDING_OUT
   - 123456789002: IN_STOCK → PENDING_OUT
✅ รอ Manager อนุมัติ
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                               Outbound Creation                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐      ┌───────────────────────┐      ┌───────────────────────┐
│  Warehouse   │─────▶│   OutboundHeader      │─────▶│    OutboundLine       │
│    User      │      │                       │      │                       │
└──────────────┘      │ delivery_note_no:     │      │ outbound_id: 1        │
                      │   OUT-2026-000001     │      │ product_item_id: 1    │
                      │ clinic_id: 1          │      │ sku: FIL-001          │
                      │ warehouse_id: 1       │      │ item_name: Filler...  │
                      │ shipping_method_id: 1 │      └───────────────────────┘
                      │ status: PENDING       │
                      │ purchase_order_id: 1  │
                      │ created_by_id: 2      │
                      └───────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              ProductItem Update                                      │
│                                                                                      │
│   serial12: 123456789001                                                            │
│   status: IN_STOCK → PENDING_OUT  ◀── รอการอนุมัติ                                   │
│   assigned_clinic_id: NULL → 1    ◀── กำหนดคลินิกปลายทาง                             │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘

                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                EventLog Created                                      │
│                                                                                      │
│   event_type: OUTBOUND                                                              │
│   product_item_id: 1                                                                │
│   user_id: 2                                                                        │
│   details: { outboundNo: "OUT-2026-000001", clinicId: 1 }                           │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### ตรวจสอบ Database

```sql
-- ตรวจสอบ Outbound Header
SELECT * FROM "OutboundHeader" ORDER BY id DESC LIMIT 1;

-- ตรวจสอบ Outbound Lines
SELECT ol.*, pi.serial12, pi.status
FROM "OutboundLine" ol
JOIN "ProductItem" pi ON ol.product_item_id = pi.id
WHERE ol.outbound_id = 1;

-- ตรวจสอบ ProductItem ที่เปลี่ยนสถานะ
SELECT serial12, status, assigned_clinic_id
FROM "ProductItem"
WHERE status = 'PENDING_OUT';
```

---

## 7. Test Case 5: Manager อนุมัติ/ปฏิเสธ

### วัตถุประสงค์
ทดสอบ Approval Workflow ของ Manager

### ผู้ทดสอบ
**Role:** `MANAGER` หรือ `ADMIN`

### 7.1 Test Case: อนุมัติ (Approve)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login ด้วย `manager1` / `manager123` | เข้า Dashboard |
| 2 | คลิกเมนู **"อนุมัติใบส่งออก"** | แสดง Approval Board |
| 3 | ดู Tab **"รออนุมัติ"** | แสดง OUT-2026-000001 |
| 4 | คลิกดูรายละเอียด | แสดงข้อมูลครบ |
| 5 | ตรวจสอบ: | |
| | - คลินิกปลายทาง | ABC Clinic |
| | - รายการสินค้า | 2 รายการ |
| | - ผู้สร้าง | warehouse1 |
| 6 | กดปุ่ม **"อนุมัติ"** | ✅ อนุมัติสำเร็จ |

### ผลลัพธ์ที่คาดหวัง (Approve)

```
✅ Outbound สถานะ: PENDING → APPROVED
✅ สินค้าเปลี่ยนสถานะ:
   - 123456789001: PENDING_OUT → SHIPPED
   - 123456789002: PENDING_OUT → SHIPPED
✅ บันทึก approved_by_id, approved_at
✅ PO shipped_quantity เพิ่มขึ้น (ถ้าอ้างอิง PO)
```

### 7.2 Test Case: ปฏิเสธ (Reject)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | (ทดสอบกับ Outbound อื่น) | |
| 2 | คลิกดูรายละเอียด Outbound | |
| 3 | กดปุ่ม **"ปฏิเสธ"** | แสดง Modal |
| 4 | กรอกเหตุผล: `ข้อมูลคลินิกไม่ถูกต้อง` | |
| 5 | กด **"ยืนยันปฏิเสธ"** | ❌ ปฏิเสธสำเร็จ |

### ผลลัพธ์ที่คาดหวัง (Reject)

```
✅ Outbound สถานะ: PENDING → REJECTED
✅ สินค้ากลับสถานะ:
   - 123456789001: PENDING_OUT → IN_STOCK
   - 123456789002: PENDING_OUT → IN_STOCK
✅ บันทึก reject_reason
✅ assigned_clinic_id กลับเป็น NULL
```

### Data Flow (Approve)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                 APPROVAL FLOW                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐      ┌───────────────────────┐
│   Manager    │─────▶│   OutboundHeader      │
│    User      │      │                       │
└──────────────┘      │ status: PENDING       │
                      │         ↓             │
                      │ status: APPROVED      │
                      │ approved_by_id: 3     │
                      │ approved_at: now()    │
                      │ shipped_at: now()     │
                      └───────────┬───────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              ProductItem Update                                      │
│                                                                                      │
│   serial12: 123456789001                                                            │
│   status: PENDING_OUT → SHIPPED  ◀── สินค้าถูกส่งแล้ว                                │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘

                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            PurchaseOrder Update                                      │
│   (ถ้าอ้างอิง PO)                                                                    │
│                                                                                      │
│   PurchaseOrderLine.shipped_quantity += จำนวนที่ส่ง                                  │
│   PurchaseOrder.status อาจเปลี่ยนเป็น PARTIAL หรือ COMPLETED                         │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘

                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                EventLog Created                                      │
│                                                                                      │
│   event_type: APPROVE                                                               │
│   user_id: 3 (manager)                                                              │
│   details: { outboundNo: "OUT-2026-000001" }                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Test Case 6: ตรวจสอบความแท้ (Verify)

### วัตถุประสงค์
ทดสอบการตรวจสอบความแท้ของสินค้าโดยไม่ต้อง Login

### ผู้ทดสอบ
**Role:** `PUBLIC` (ไม่ต้อง Login)

### 8.1 ตรวจสอบผ่าน QR Code

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | เปิดมือถือ | |
| 2 | สแกน QR Code บนสินค้า | เปิดหน้า Verify |
| 3 | URL: `/v/123456789001` | |
| 4 | ดูผลลัพธ์ | แสดงข้อมูลสินค้า |

### 8.2 ตรวจสอบผ่าน Serial

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | เปิด `/th/verify` | แสดงหน้า Verify |
| 2 | กรอก Serial: `123456789001` | |
| 3 | กดปุ่ม **"ตรวจสอบ"** | แสดงผลลัพธ์ |

### ผลลัพธ์ตามสถานะสินค้า

| สถานะสินค้า | สีแสดงผล | ข้อความ | ปุ่ม Activate |
|-------------|----------|---------|---------------|
| `IN_STOCK` | 🟢 เขียว | ของแท้ - อยู่ในคลัง | ❌ ไม่แสดง |
| `SHIPPED` | 🟢 เขียว | ของแท้ - ส่งออกแล้ว | ✅ แสดง |
| `ACTIVATED` | 🟡 เหลือง | ของแท้ - ลงทะเบียนแล้ว | ❌ ไม่แสดง |
| `RETURNED` | 🟡 เหลือง | ของแท้ - ถูกส่งคืน | ❌ ไม่แสดง |
| Token Revoked | 🔴 แดง | QR ถูกยกเลิก | ❌ ไม่แสดง |
| ไม่พบ | 🔴 แดง | ไม่พบในระบบ | ❌ ไม่แสดง |

### ข้อมูลที่แสดง (สินค้า SHIPPED)

```
┌─────────────────────────────────────────┐
│          ✅ สินค้าของแท้                  │
│                                         │
│  Serial: 123456789001                   │
│  ชื่อสินค้า: Filler XYZ 1ml              │
│  SKU: FIL-001                           │
│  หมวดหมู่: ฟิลเลอร์                       │
│  ขนาด: 1ml                              │
│  Lot: LOT2026001                        │
│  วันหมดอายุ: 01/06/2027                  │
│                                         │
│  คลินิก: ABC Clinic (ถ้าเปิด setting)     │
│  สาขา: กรุงเทพฯ                          │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │      [ ลงทะเบียนสินค้า ]         │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### Data Flow (Verify)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                 VERIFY FLOW                                          │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐      ┌───────────────────────┐
│   Customer   │─────▶│   API: /api/public/   │
│  (Scan QR)   │      │        verify         │
└──────────────┘      └───────────┬───────────┘
                                  │
                                  ▼
                      ┌───────────────────────┐
                      │   Lookup by Serial    │
                      │   or Token Hash       │
                      └───────────┬───────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
          ┌─────────────────┐        ┌─────────────────┐
          │   ProductItem   │        │    QRToken      │
          │                 │        │                 │
          │ serial12: ...   │        │ token_hash: ... │
          │ status: SHIPPED │        │ status: ACTIVE  │
          └────────┬────────┘        └─────────────────┘
                   │
                   ▼
          ┌─────────────────┐
          │    ScanLog      │  ◀── บันทึกการสแกน
          │                 │
          │ result: GENUINE │
          │   _SHIPPED      │
          │ ip_hash: abc... │
          │ user_agent: ... │
          └─────────────────┘
```

### ตรวจสอบ ScanLog

```sql
-- ดูประวัติการสแกน
SELECT sl.*, pi.serial12
FROM "ScanLog" sl
JOIN "ProductItem" pi ON sl.product_item_id = pi.id
ORDER BY sl.scanned_at DESC;
```

---

## 9. Test Case 7: ลงทะเบียนสินค้า (Activate)

### วัตถุประสงค์
ทดสอบการลงทะเบียนสินค้าโดยลูกค้า

### ผู้ทดสอบ
**Role:** `PUBLIC` (ไม่ต้อง Login)

### เงื่อนไข
- สินค้าต้องอยู่สถานะ `SHIPPED` เท่านั้น
- ต้องยินยอม PDPA

### 9.1 Test Case: SINGLE Activation

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify สินค้าที่ SHIPPED | แสดงปุ่ม "ลงทะเบียน" |
| 2 | กดปุ่ม **"ลงทะเบียน"** | แสดงฟอร์ม |
| 3 | กรอกข้อมูล (ไม่บังคับ): | |
| | - ชื่อ: `คุณสมศรี` | |
| | - อายุ: `35` | |
| | - เพศ: `หญิง` | |
| | - จังหวัด: `กรุงเทพมหานคร` | |
| | - เบอร์โทร: `081-234-5678` | |
| 4 | ติ๊ก **"ยินยอม PDPA"** | ✅ |
| 5 | กดปุ่ม **"ลงทะเบียน"** | ✅ สำเร็จ |

### ผลลัพธ์ที่คาดหวัง (SINGLE)

```
✅ Activation สำเร็จ
✅ สินค้าเปลี่ยนสถานะ: SHIPPED → ACTIVATED
✅ สร้าง Activation record:
   - activation_number: 1
   - customer_name: คุณสมศรี
   - consent_at: now()
   - policy_version: "1.0"
✅ ปุ่ม "ลงทะเบียน" หายไป
```

### 9.2 Test Case: PACK Activation (หลายครั้ง)

**เงื่อนไข:** Product Master ต้องเป็น `activation_type: PACK`, `max_activations: 3`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify สินค้าประเภท PACK | แสดงปุ่ม "ลงทะเบียน" |
| 2 | ข้อมูลแสดง: | |
| | - ประเภท: PACK | |
| | - สูงสุด: 3 ครั้ง | |
| | - ใช้แล้ว: 0 ครั้ง | |
| 3 | กดลงทะเบียนครั้งที่ 1 | activation_count: 0 → 1 |
| 4 | Verify อีกครั้ง | ยังกดลงทะเบียนได้ |
| 5 | กดลงทะเบียนครั้งที่ 2 | activation_count: 1 → 2 |
| 6 | กดลงทะเบียนครั้งที่ 3 | activation_count: 2 → 3 |
| 7 | Verify อีกครั้ง | ❌ ปุ่มหายไป (ครบแล้ว) |

### ผลลัพธ์ที่คาดหวัง (PACK)

```
✅ Activation records 3 รายการ:
   - activation_number: 1 (ครั้งที่ 1)
   - activation_number: 2 (ครั้งที่ 2)
   - activation_number: 3 (ครั้งที่ 3)
✅ ProductItem.activation_count: 3
✅ ProductItem.status: ACTIVATED (หลังครบ)
✅ canActivate: false
```

### Data Flow (Activate)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                               ACTIVATION FLOW                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐      ┌───────────────────────┐
│   Customer   │─────▶│ API: /api/public/     │
│  (Register)  │      │      activate         │
└──────────────┘      └───────────┬───────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              ProductItem Update                                      │
│                                                                                      │
│   SINGLE Type:                                                                      │
│   - status: SHIPPED → ACTIVATED                                                     │
│   - activation_count: 0 → 1                                                         │
│                                                                                      │
│   PACK Type:                                                                        │
│   - status: SHIPPED (ยังไม่เปลี่ยนจนกว่าจะครบ)                                        │
│   - activation_count: +1 (ทุกครั้งที่ activate)                                      │
│   - status: → ACTIVATED (เมื่อครบ max_activations)                                   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘

                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              Activation Record                                       │
│                                                                                      │
│   ┌─────────────────────────────────────────┐                                       │
│   │           Activation                    │                                       │
│   │                                         │                                       │
│   │  product_item_id: 1                     │                                       │
│   │  activation_number: 1 (หรือ 2, 3...)    │                                       │
│   │  customer_name: คุณสมศรี (optional)      │                                       │
│   │  age: 35 (optional)                     │                                       │
│   │  gender: F (optional)                   │                                       │
│   │  province: กรุงเทพฯ (optional)           │                                       │
│   │  phone: 081-xxx (optional)              │                                       │
│   │  consent_at: 2026-02-05T10:30:00Z       │  ◀── PDPA consent timestamp           │
│   │  policy_version: "1.0"                  │                                       │
│   └─────────────────────────────────────────┘                                       │
└─────────────────────────────────────────────────────────────────────────────────────┘

                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                EventLog Created                                      │
│                                                                                      │
│   event_type: ACTIVATE                                                              │
│   product_item_id: 1                                                                │
│   details: { activationNumber: 1, customerName: "คุณสมศรี" }                         │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### ตรวจสอบ Database

```sql
-- ดู Activation records
SELECT a.*, pi.serial12
FROM "Activation" a
JOIN "ProductItem" pi ON a.product_item_id = pi.id
ORDER BY a.created_at DESC;

-- ดูจำนวน activation ต่อสินค้า
SELECT serial12, status, activation_count
FROM "ProductItem"
WHERE activation_count > 0;
```

---

## 10. Test Case 8: พิมพ์ QR ใหม่ (Reprint)

### วัตถุประสงค์
ทดสอบการพิมพ์ QR ใหม่เมื่อ Label เสียหาย (Token เดิมถูก Revoke)

### ผู้ทดสอบ
**Role:** `WAREHOUSE` หรือ `ADMIN`

### เงื่อนไข
- สินค้าต้อง **ไม่ใช่** `ACTIVATED` หรือ `RETURNED`
- สามารถ Reprint ได้: `IN_STOCK`, `PENDING_OUT`, `SHIPPED`

### ขั้นตอนการทดสอบ

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login ด้วย `warehouse1` | เข้า Dashboard |
| 2 | คลิกเมนู **"พิมพ์ QR ใหม่"** | แสดงหน้า Reprint |
| 3 | ค้นหา Serial: `123456789001` | แสดงข้อมูลสินค้า |
| 4 | ตรวจสอบข้อมูล: | |
| | - Serial: 123456789001 | |
| | - Token Version: 1 | |
| | - Status: IN_STOCK | |
| 5 | กรอกเหตุผล: `Label เปื้อน อ่านไม่ออก` | |
| 6 | กดปุ่ม **"พิมพ์ใหม่"** | ✅ สำเร็จ |

### ผลลัพธ์ที่คาดหวัง

```
✅ Token เดิม (version 1) ถูก Revoke:
   - status: ACTIVE → REVOKED
   - revoked_at: now()
   - revoke_reason: "Reprint - Label เปื้อน..."

✅ Token ใหม่ (version 2) ถูกสร้าง:
   - token_version: 2
   - token: (encrypted ใหม่)
   - token_hash: (hash ใหม่)
   - status: ACTIVE

✅ Download PDF Label ใหม่
```

### Data Flow (Reprint)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                REPRINT FLOW                                          │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐      ┌───────────────────────────────────────────────────────────────┐
│  Warehouse   │      │                      QRToken Table                            │
│    User      │      │                                                               │
└──────┬───────┘      │  ┌─────────────────────────────────────────────────────────┐  │
       │              │  │  Token Version 1 (เดิม)                                 │  │
       │              │  │                                                         │  │
       │              │  │  product_item_id: 1                                     │  │
       │              │  │  token_version: 1                                       │  │
       │  Reprint     │  │  status: ACTIVE → REVOKED  ◀── ถูก Revoke               │  │
       │──────────────▶  │  revoked_at: 2026-02-05T11:00:00Z                       │  │
       │              │  │  revoke_reason: "Reprint - Label เปื้อน"                │  │
       │              │  └─────────────────────────────────────────────────────────┘  │
       │              │                                                               │
       │              │  ┌─────────────────────────────────────────────────────────┐  │
       │              │  │  Token Version 2 (ใหม่)                                 │  │
       │              │  │                                                         │  │
       │              │  │  product_item_id: 1                                     │  │
       │              │  │  token_version: 2        ◀── Version +1                 │  │
       │              │  │  token: (encrypted ใหม่)                                │  │
       │              │  │  token_hash: (hash ใหม่)                                │  │
       │              │  │  status: ACTIVE          ◀── Token ใหม่ใช้งานได้        │  │
       │              │  │  issued_at: now()                                       │  │
       │              │  └─────────────────────────────────────────────────────────┘  │
       │              └───────────────────────────────────────────────────────────────┘
       │
       │              ┌───────────────────────────────────────────────────────────────┐
       │              │                        EventLog                               │
       │              │                                                               │
       └─────────────▶│  event_type: REPRINT                                         │
                      │  product_item_id: 1                                          │
                      │  user_id: 2                                                  │
                      │  details: { oldVersion: 1, newVersion: 2, reason: "..." }    │
                      └───────────────────────────────────────────────────────────────┘
```

### ทดสอบสแกน QR เก่า

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | สแกน QR Code เดิม (version 1) | |
| 2 | ดูผลลัพธ์ | 🔴 **TOKEN_REVOKED** |
| 3 | ข้อความ: | "QR นี้ถูกยกเลิกแล้ว กรุณาใช้ QR ใหม่" |

### ตรวจสอบ Database

```sql
-- ดู Token ทั้งหมดของสินค้า
SELECT qt.*, pi.serial12
FROM "QRToken" qt
JOIN "ProductItem" pi ON qt.product_item_id = pi.id
WHERE pi.serial12 = '123456789001'
ORDER BY qt.token_version;

-- ดู EventLog
SELECT * FROM "EventLog"
WHERE event_type = 'REPRINT'
ORDER BY created_at DESC;
```

---

## 11. Test Case 9: รับคืนสินค้า (Return)

### วัตถุประสงค์
ทดสอบการรับคืนสินค้าจากคลินิก/ลูกค้า

### ผู้ทดสอบ
**Role:** `WAREHOUSE` หรือ `ADMIN`

### เงื่อนไข
- สามารถรับคืนได้: `SHIPPED` หรือ `ACTIVATED`
- ไม่สามารถรับคืน: `IN_STOCK`, `PENDING_OUT`, `PENDING_LINK`

### ขั้นตอนการทดสอบ

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login ด้วย `warehouse1` | เข้า Dashboard |
| 2 | คลิกเมนู **"รับคืนสินค้า"** | แสดงหน้า Return |
| 3 | ค้นหา Serial: `123456789001` | แสดงข้อมูลสินค้า |
| 4 | ตรวจสอบ: | |
| | - Status: SHIPPED หรือ ACTIVATED | |
| | - คลินิก: ABC Clinic | |
| 5 | เลือกเหตุผล: `สินค้าไม่ตรงตามสั่ง` | |
| 6 | กรอกหมายเหตุ: `ลูกค้าต้องการเปลี่ยน` | |
| 7 | กดปุ่ม **"บันทึกการคืน"** | ✅ สำเร็จ |

### ผลลัพธ์ที่คาดหวัง

```
✅ สินค้าเปลี่ยนสถานะ: SHIPPED/ACTIVATED → RETURNED
✅ assigned_clinic_id: 1 → NULL (ไม่ได้ assign คลินิกแล้ว)
✅ QR Token ยังคง ACTIVE (ยังสแกนได้ แต่แสดงสถานะ RETURNED)
✅ บันทึก EventLog
```

### Data Flow (Return)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                 RETURN FLOW                                          │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐      ┌───────────────────────────────────────────────────────────────┐
│  Warehouse   │      │                      ProductItem                              │
│    User      │      │                                                               │
└──────┬───────┘      │  serial12: 123456789001                                       │
       │              │  status: SHIPPED → RETURNED  ◀── สถานะเปลี่ยน                 │
       │              │  assigned_clinic_id: 1 → NULL  ◀── ไม่ assign คลินิก          │
       │   Return     │                                                               │
       │──────────────▶                                                               │
       │              └───────────────────────────────────────────────────────────────┘
       │
       │              ┌───────────────────────────────────────────────────────────────┐
       │              │                        EventLog                               │
       │              │                                                               │
       └─────────────▶│  event_type: RETURN                                          │
                      │  product_item_id: 1                                          │
                      │  user_id: 2                                                  │
                      │  details: {                                                  │
                      │    previousStatus: "SHIPPED",                                │
                      │    reason: "สินค้าไม่ตรงตามสั่ง",                              │
                      │    remarks: "ลูกค้าต้องการเปลี่ยน"                             │
                      │  }                                                           │
                      └───────────────────────────────────────────────────────────────┘
```

### ทดสอบสแกน QR หลังคืน

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | สแกน QR ของสินค้าที่คืนแล้ว | |
| 2 | ดูผลลัพธ์ | 🟡 **GENUINE_RETURNED** |
| 3 | ข้อความ: | "ของแท้ - สินค้านี้ถูกส่งคืนแล้ว" |

---

## 12. Test Case 10: สินค้าเสียหาย (Damaged)

### วัตถุประสงค์
ทดสอบการบันทึกสินค้าเสียหาย

### ผู้ทดสอบ
**Role:** `WAREHOUSE` หรือ `ADMIN`

### เงื่อนไข
- สามารถ mark เป็น DAMAGED ได้ทุกสถานะ ยกเว้น `ACTIVATED`

### ขั้นตอนการทดสอบ

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login ด้วย `warehouse1` | เข้า Dashboard |
| 2 | คลิกเมนู **"สินค้าเสียหาย"** | แสดงรายการ |
| 3 | กดปุ่ม **"บันทึกสินค้าเสียหาย"** | แสดงฟอร์ม |
| 4 | ค้นหา Serial: `123456789003` | แสดงข้อมูลสินค้า |
| 5 | เลือกเหตุผล: `สินค้าแตก` | |
| 6 | กรอกหมายเหตุ: `พบตอนตรวจรับ` | |
| 7 | กดปุ่ม **"บันทึก"** | ✅ สำเร็จ |

### ผลลัพธ์ที่คาดหวัง

```
✅ สินค้าเปลี่ยนสถานะ: IN_STOCK → DAMAGED
✅ บันทึก EventLog
✅ แสดงในรายการสินค้าเสียหาย
```

### Data Flow (Damaged)

```
┌──────────────┐      ┌───────────────────────────────────────────────────────────────┐
│  Warehouse   │      │                      ProductItem                              │
│    User      │      │                                                               │
└──────┬───────┘      │  serial12: 123456789003                                       │
       │              │  status: IN_STOCK → DAMAGED  ◀── สถานะเปลี่ยน                 │
       │   Damaged    │                                                               │
       │──────────────▶                                                               │
       │              └───────────────────────────────────────────────────────────────┘
       │
       │              ┌───────────────────────────────────────────────────────────────┐
       │              │                        EventLog                               │
       │              │                                                               │
       └─────────────▶│  event_type: DAMAGED                                         │
                      │  product_item_id: 3                                          │
                      │  user_id: 2                                                  │
                      │  details: {                                                  │
                      │    reason: "สินค้าแตก",                                       │
                      │    remarks: "พบตอนตรวจรับ"                                    │
                      │  }                                                           │
                      └───────────────────────────────────────────────────────────────┘
```

---

## 13. Test Case 11: ยืมสินค้า/สั่งฝาก (Loan/Reservation)

### วัตถุประสงค์
ทดสอบการสั่งฝากสินค้าผ่าน Purchase Order + ดู Reservation

### ผู้ทดสอบ
**Role:** `ADMIN`

### Flow การยืม/สั่งฝาก

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ สร้าง PO    │────▶│ ยืนยัน PO   │────▶│ สร้าง       │────▶│ อนุมัติ      │
│ (DRAFT)     │     │ (CONFIRMED) │     │ Outbound    │     │ (SHIPPED)   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### ขั้นตอนการทดสอบ

#### Part A: สร้าง PO สั่งฝาก

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | สร้าง PO สำหรับ ABC Clinic | PO-2026-000002 |
| 2 | เพิ่มรายการ: | |
| | - FIL-001 x 5 ชิ้น | |
| | - BOT-001 x 3 ชิ้น | |
| 3 | ยืนยัน PO | status: CONFIRMED |

#### Part B: ดู Clinic Reservations

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | ไปที่เมนู **"จัดการคลินิก"** | |
| 2 | เลือก ABC Clinic | |
| 3 | คลิก Tab **"สินค้าสั่งฝาก"** | แสดงรายการ PO |
| 4 | ดูรายละเอียด: | |
| | - PO-2026-000002 | |
| | - FIL-001: สั่ง 5, ส่งแล้ว 0 | |
| | - BOT-001: สั่ง 3, ส่งแล้ว 0 | |

#### Part C: ส่งสินค้าตาม PO

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | สร้าง Outbound อ้างอิง PO-2026-000002 | |
| 2 | เลือกสินค้า FIL-001 จำนวน 3 ชิ้น | |
| 3 | ส่งขออนุมัติ | |
| 4 | Manager อนุมัติ | |
| 5 | ตรวจสอบ PO: | |
| | - FIL-001: สั่ง 5, ส่งแล้ว 3 | |
| | - status: PARTIAL | |

#### Part D: ส่งครบ

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | สร้าง Outbound อ้างอิง PO เดิม | |
| 2 | ส่ง FIL-001 อีก 2 + BOT-001 3 ชิ้น | |
| 3 | อนุมัติ | |
| 4 | ตรวจสอบ PO: | |
| | - FIL-001: สั่ง 5, ส่งแล้ว 5 ✅ | |
| | - BOT-001: สั่ง 3, ส่งแล้ว 3 ✅ | |
| | - status: COMPLETED | |

### Data Flow (Reservation)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           RESERVATION / LOAN FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐      ┌───────────────────────┐      ┌───────────────────────┐
│   Clinic     │◀────▶│    PurchaseOrder      │◀────▶│  PurchaseOrderLine    │
│              │      │                       │      │                       │
│ id: 1        │      │ po_no: PO-2026-0002   │      │ product_master_id: 1  │
│ name: ABC    │      │ clinic_id: 1          │      │ quantity: 5           │
└──────────────┘      │ status: CONFIRMED     │      │ shipped_quantity: 0→5 │
                      └───────────┬───────────┘      └───────────────────────┘
                                  │
                                  │ (อ้างอิงจาก Outbound)
                                  ▼
                      ┌───────────────────────┐
                      │   OutboundHeader      │
                      │                       │
                      │ purchase_order_id: 2  │
                      │ clinic_id: 1          │
                      └───────────────────────┘
                                  │
                                  │ (เมื่ออนุมัติ)
                                  ▼
                      ┌───────────────────────────────────────────────────────────────┐
                      │                  Update shipped_quantity                       │
                      │                                                               │
                      │  PurchaseOrderLine.shipped_quantity += จำนวนที่ส่ง             │
                      │                                                               │
                      │  ถ้า shipped_quantity < quantity ทุก line:                     │
                      │    PurchaseOrder.status = PARTIAL                             │
                      │                                                               │
                      │  ถ้า shipped_quantity = quantity ทุก line:                     │
                      │    PurchaseOrder.status = COMPLETED                           │
                      └───────────────────────────────────────────────────────────────┘
```

---

## 14. สรุป Data Flow ทั้งระบบ

### Complete System Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                   MASTER DATA                                        │
│                                                                                      │
│   ProductCategory ──┬── ProductMaster ──┬── Unit                                    │
│                     │                    │                                           │
│   Warehouse ────────┼────────────────────┼── ShippingMethod                         │
│                     │                    │                                           │
│   Clinic ───────────┴────────────────────┘                                          │
│      │                                                                              │
│      └──── User (ADMIN, MANAGER, WAREHOUSE)                                         │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              OPERATIONAL FLOW                                        │
│                                                                                      │
│   ┌────────────────┐                                                                │
│   │ Pre-Generate   │                                                                │
│   │ Batch          │                                                                │
│   └───────┬────────┘                                                                │
│           │ creates                                                                 │
│           ▼                                                                         │
│   ┌────────────────┐     ┌─────────────┐     ┌─────────────┐                       │
│   │  ProductItem   │◀────│   GRNLine   │◀────│  GRNHeader  │                       │
│   │                │     └─────────────┘     └─────────────┘                       │
│   │  PENDING_LINK  │                                                               │
│   │      ↓         │                                                               │
│   │   IN_STOCK     │     ┌─────────────┐     ┌───────────────┐                     │
│   │      ↓         │────▶│OutboundLine │◀────│OutboundHeader │                     │
│   │  PENDING_OUT   │     └─────────────┘     └───────┬───────┘                     │
│   │      ↓         │                                 │                             │
│   │   SHIPPED      │◀────────── Manager Approve ─────┘                             │
│   │      ↓         │                                                               │
│   │  ACTIVATED     │◀────────── Customer Activate                                  │
│   │      ↓         │                                                               │
│   │   RETURNED     │◀────────── Warehouse Return                                   │
│   │                │                                                               │
│   │   DAMAGED      │◀────────── Warehouse Mark                                     │
│   └───────┬────────┘                                                               │
│           │                                                                         │
│           │ has                                                                     │
│           ▼                                                                         │
│   ┌────────────────┐                                                                │
│   │    QRToken     │ ──── Version Control for Reprint                              │
│   │                │                                                                │
│   │  ACTIVE        │                                                                │
│   │  REVOKED       │                                                                │
│   └───────┬────────┘                                                                │
│           │                                                                         │
│           │ has many                                                                │
│           ▼                                                                         │
│   ┌────────────────┐                                                                │
│   │   Activation   │ ──── 1:N for PACK type                                        │
│   │                │                                                                │
│   │ customer info  │                                                                │
│   │ consent (PDPA) │                                                                │
│   └────────────────┘                                                                │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                  AUDIT TRAIL                                         │
│                                                                                      │
│   ┌────────────────┐              ┌────────────────┐                                │
│   │    ScanLog     │              │    EventLog    │                                │
│   │                │              │                │                                │
│   │ - product_id   │              │ - event_type   │                                │
│   │ - result       │              │ - product_id   │                                │
│   │ - ip_hash      │              │ - user_id      │                                │
│   │ - user_agent   │              │ - details      │                                │
│   │ - scanned_at   │              │ - created_at   │                                │
│   └────────────────┘              └────────────────┘                                │
│                                                                                      │
│   Event Types:                                                                      │
│   INBOUND, OUTBOUND, APPROVE, REJECT, ACTIVATE, REPRINT, RETURN, DAMAGED,          │
│   PRE_GENERATE, LINK_PRODUCT                                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 15. Checklist การทดสอบ

### Pre-Deployment Checklist

#### Master Data Setup
- [ ] มี ProductCategory อย่างน้อย 1 รายการ
- [ ] มี Unit อย่างน้อย 1 รายการ
- [ ] มี ShippingMethod อย่างน้อย 1 รายการ
- [ ] มี Warehouse อย่างน้อย 1 รายการ
- [ ] มี Clinic อย่างน้อย 1 รายการ
- [ ] มี ProductMaster อย่างน้อย 1 รายการ
- [ ] มี User ครบทุก Role (ADMIN, MANAGER, WAREHOUSE)

#### Functional Test
- [ ] **TC1:** Pre-Generate QR สำเร็จ
- [ ] **TC2:** สร้าง GRN + เชื่อมโยง Pre-Gen สำเร็จ
- [ ] **TC3:** สร้าง Purchase Order สำเร็จ
- [ ] **TC4:** สร้าง Outbound สำเร็จ
- [ ] **TC5a:** Manager Approve สำเร็จ
- [ ] **TC5b:** Manager Reject สำเร็จ
- [ ] **TC6:** Verify (Public) แสดงผลถูกต้อง
- [ ] **TC7a:** Activate (SINGLE) สำเร็จ
- [ ] **TC7b:** Activate (PACK) หลายครั้งสำเร็จ
- [ ] **TC8:** Reprint QR สำเร็จ + Token เดิม Revoked
- [ ] **TC9:** Return สินค้าสำเร็จ
- [ ] **TC10:** Mark Damaged สำเร็จ
- [ ] **TC11:** Reservation flow ครบ

#### Security Test
- [ ] Login ด้วย password ผิด → ถูก reject
- [ ] เข้าหน้า Admin โดยไม่ login → redirect to login
- [ ] WAREHOUSE เข้า Approval Board → 403 Forbidden
- [ ] PUBLIC เข้า Dashboard → redirect to login
- [ ] Rate Limit ทำงาน (60 req/min for public)

#### Edge Cases
- [ ] Verify ด้วย Serial ที่ไม่มี → แสดง INVALID
- [ ] Activate สินค้าที่ไม่ใช่ SHIPPED → Error
- [ ] Reprint สินค้า ACTIVATED → Error
- [ ] Return สินค้า IN_STOCK → Error
- [ ] สแกน QR ที่ถูก Revoke → แสดง TOKEN_REVOKED

#### PDF Generation
- [ ] Label 4x6 นิ้วถูกต้อง
- [ ] QR Code สแกนได้
- [ ] ภาษาไทยแสดงถูกต้อง

#### Multi-Language
- [ ] `/th/...` แสดงภาษาไทย
- [ ] `/en/...` แสดงภาษาอังกฤษ
- [ ] สลับภาษาได้

---

## Demo Script สำหรับลูกค้า (30 นาที)

### ลำดับการ Demo

| เวลา | หัวข้อ | ผู้ทำ | สิ่งที่แสดง |
|------|--------|-------|------------|
| 0-2 | แนะนำระบบ | - | ภาพรวม, เป้าหมาย |
| 2-5 | Admin Setup | ADMIN | Master Data, Users |
| 5-8 | Pre-Gen QR | WAREHOUSE | สร้าง Batch 5 ชิ้น |
| 8-13 | GRN | WAREHOUSE | รับเข้า + เชื่อมโยง |
| 13-15 | Print Label | WAREHOUSE | พิมพ์ PDF |
| 15-18 | Create PO | ADMIN | สั่งฝากสินค้า |
| 18-22 | Outbound | WAREHOUSE | สร้างใบส่ง |
| 22-24 | Approval | MANAGER | อนุมัติ |
| 24-26 | Verify | PUBLIC | สแกนตรวจสอบ (มือถือ) |
| 26-28 | Activate | PUBLIC | ลงทะเบียน + PDPA |
| 28-30 | Q&A | - | ถามตอบ |

### Tips สำหรับ Demo
1. **เตรียม QR ไว้ล่วงหน้า** - พิมพ์ Label จริง 2-3 ใบ
2. **ใช้มือถือสแกนจริง** - แสดง User Experience
3. **เปิด Database** - แสดงข้อมูลเปลี่ยนแปลง real-time
4. **เตรียม 2 Browser** - สำหรับสลับ Role

---

**จบเอกสาร**

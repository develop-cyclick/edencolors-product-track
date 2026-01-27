# คู่มือการใช้งานระบบ QR Authenticity & Activation

## สารบัญ
1. [ภาพรวมระบบ](#1-ภาพรวมระบบ)
2. [การติดตั้งและเริ่มต้นใช้งาน](#2-การติดตั้งและเริ่มต้นใช้งาน)
3. [การเข้าสู่ระบบ](#3-การเข้าสู่ระบบ)
4. [สำหรับพนักงานคลัง (Warehouse)](#4-สำหรับพนักงานคลัง-warehouse)
5. [สำหรับผู้จัดการ (Manager)](#5-สำหรับผู้จัดการ-manager)
6. [สำหรับผู้ดูแลระบบ (Admin)](#6-สำหรับผู้ดูแลระบบ-admin)
7. [สำหรับคลินิก/ลูกค้า (Public)](#7-สำหรับคลินิกลูกค้า-public)
8. [API Reference](#8-api-reference)

---

## 1. ภาพรวมระบบ

ระบบ QR Authenticity & Activation เป็นระบบติดตามและยืนยันความแท้ของสินค้าด้วย QR Code + Serial 12 หลัก

### Flow การทำงานหลัก
```
รับเข้าคลัง (GRN) → ส่งออก (Outbound) → Manager อนุมัติ → คลินิกตรวจสอบ → ลูกค้า Activate
```

### บทบาทผู้ใช้งาน (Roles)
| Role | สิทธิ์การใช้งาน |
|------|----------------|
| **Admin** | จัดการผู้ใช้, คลินิก, Master Data, ดู Event Logs |
| **Manager** | อนุมัติ/ปฏิเสธใบส่งออก, ดูรายงาน |
| **Warehouse** | สร้าง GRN, สร้างใบส่งออก, พิมพ์ QR, รับคืนสินค้า |

---

## 2. การติดตั้งและเริ่มต้นใช้งาน

### ความต้องการระบบ
- Node.js 18+
- Docker Desktop
- Git

### ขั้นตอนการติดตั้ง

```bash
# 1. Clone โปรเจค
git clone <repository-url>
cd edencolors

# 2. ติดตั้ง dependencies
npm install

# 3. สร้างไฟล์ .env (copy จาก .env.example)
cp .env.example .env

# 4. เริ่ม Database (PostgreSQL + Redis)
npm run db:up

# 5. Generate Prisma Client
npm run db:generate

# 6. Push Schema to Database
npm run db:push

# 7. Seed ข้อมูลเริ่มต้น
npm run db:seed

# 8. เริ่ม Development Server
npm run dev
```

### เข้าใช้งาน
เปิดเบราว์เซอร์ไปที่: `http://localhost:3000`

---

## 3. การเข้าสู่ระบบ

### URL เข้าสู่ระบบ
- ภาษาไทย: `http://localhost:3000/th/login`
- English: `http://localhost:3000/en/login`

### บัญชีทดสอบ (Test Accounts)
| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin123 |
| Warehouse | warehouse1 | warehouse123 |
| Manager | manager1 | manager123 |

### วิธีเข้าสู่ระบบ
1. เปิดหน้า Login
2. กรอก Username และ Password
3. กดปุ่ม "เข้าสู่ระบบ"
4. ระบบจะนำไปยัง Dashboard ตาม Role

---

## 4. สำหรับพนักงานคลัง (Warehouse)

### 4.1 สร้างใบรับเข้าคลัง (GRN)

**เมนู:** Dashboard → ใบรับเข้าคลัง → สร้างใหม่

**ขั้นตอน:**
1. กรอกข้อมูลหัวเอกสาร:
   - วันที่รับ
   - คลังสินค้า
   - เลขที่ PO
   - ข้อมูลผู้ส่ง (ชื่อ, ที่อยู่, เบอร์โทร)

2. เพิ่มรายการสินค้า:
   - เลือกหมวดหมู่สินค้า
   - กรอก SKU, ชื่อสินค้า, ขนาด/รุ่น
   - กรอก Lot, วันหมดอายุ
   - ระบุจำนวน

3. กดปุ่ม "บันทึก"

**ผลลัพธ์:**
- ระบบสร้าง Serial Number 12 หลักอัตโนมัติ
- ระบบสร้าง QR Token (เข้ารหัส JWE) อัตโนมัติ
- สินค้ามีสถานะ `IN_STOCK`

### 4.2 พิมพ์ QR Label

**เมนู:** Dashboard → ใบรับเข้าคลัง → เลือก GRN → พิมพ์ Label

**ขั้นตอน:**
1. เปิดรายละเอียด GRN ที่ต้องการ
2. กดปุ่ม "พิมพ์ Label"
3. ระบบจะ Download ไฟล์ PDF (4x6 นิ้ว)
4. นำไปพิมพ์และติดบนสินค้า

**รูปแบบ Label:**
- QR Code (สแกนเพื่อตรวจสอบ)
- Serial Number 12 หลัก
- ชื่อสินค้า, SKU
- Lot, วันหมดอายุ

### 4.3 สร้างใบส่งออก (Outbound)

**เมนู:** Dashboard → ใบส่งออก → สร้างใหม่

**ขั้นตอน:**
1. เลือกคลังสินค้าต้นทาง
2. เลือกคลินิกปลายทาง
3. เลือกวิธีจัดส่ง
4. กรอกข้อมูลติดต่อ
5. เลือกสินค้าที่จะส่ง (เฉพาะสถานะ `IN_STOCK`)
6. กดปุ่ม "ส่งขออนุมัติ"

**ผลลัพธ์:**
- ใบส่งออกมีสถานะ `PENDING`
- สินค้าเปลี่ยนเป็น `PENDING_OUT`
- รอ Manager อนุมัติ

### 4.4 พิมพ์ QR ใหม่ (Reprint)

**เมนู:** Dashboard → พิมพ์ QR ใหม่

**ใช้เมื่อ:**
- Label เดิมชำรุด/เปื้อน
- สินค้าติด Label ผิด
- ต้องการ Label ใหม่

**ขั้นตอน:**
1. ค้นหาสินค้าด้วย Serial Number
2. เลือกสินค้าที่ต้องการพิมพ์ใหม่
3. ระบุเหตุผล
4. กดปุ่ม "พิมพ์ใหม่"

**ผลลัพธ์:**
- Token เดิมถูก Revoke (ใช้ไม่ได้แล้ว)
- สร้าง Token ใหม่ (Version +1)
- Download PDF Label ใหม่

**ข้อจำกัด:**
- ไม่สามารถ Reprint สินค้าที่ `ACTIVATED` แล้ว
- ไม่สามารถ Reprint สินค้าที่ `RETURNED` แล้ว

### 4.5 รับคืนสินค้า (Return)

**เมนู:** Dashboard → รับคืนสินค้า

**ขั้นตอน:**
1. ค้นหาสินค้าด้วย Serial Number
2. เลือกสินค้าที่จะรับคืน
3. เลือกเหตุผลการคืน
4. กรอกหมายเหตุเพิ่มเติม (ถ้ามี)
5. กดปุ่ม "บันทึกการคืน"

**ผลลัพธ์:**
- สินค้าเปลี่ยนสถานะเป็น `RETURNED`
- บันทึก Event Log

**ข้อจำกัด:**
- รับคืนได้เฉพาะสถานะ `SHIPPED` หรือ `ACTIVATED`
- ไม่สามารถรับคืนสินค้า `IN_STOCK`

---

## 5. สำหรับผู้จัดการ (Manager)

### 5.1 อนุมัติ/ปฏิเสธใบส่งออก

**เมนู:** Dashboard → อนุมัติใบส่งออก

**ขั้นตอน:**
1. ดูรายการใบส่งออกที่รอ (`PENDING`)
2. คลิกดูรายละเอียด
3. ตรวจสอบข้อมูล:
   - คลินิกปลายทาง
   - รายการสินค้า
   - ข้อมูลการจัดส่ง
4. เลือก:
   - **อนุมัติ:** สินค้าเปลี่ยนเป็น `SHIPPED`
   - **ปฏิเสธ:** ต้องระบุเหตุผล, สินค้ากลับเป็น `IN_STOCK`

### 5.2 ดูประวัติการอนุมัติ

**เมนู:** Dashboard → อนุมัติใบส่งออก → เลือก Tab

| Tab | แสดงรายการ |
|-----|-----------|
| รออนุมัติ | PENDING |
| อนุมัติแล้ว | APPROVED |
| ปฏิเสธ | REJECTED |

---

## 6. สำหรับผู้ดูแลระบบ (Admin)

### 6.1 จัดการผู้ใช้

**เมนู:** Dashboard → จัดการผู้ใช้

**สามารถทำได้:**
- เพิ่มผู้ใช้ใหม่
- แก้ไขข้อมูลผู้ใช้
- เปลี่ยน Role
- Reset Password
- ปิดใช้งาน (Disable)

### 6.2 จัดการคลินิก

**เมนู:** Dashboard → จัดการคลินิก

**ข้อมูลคลินิก:**
- ชื่อคลินิก / สาขา
- จังหวัด
- ที่อยู่ / เบอร์โทร / อีเมล
- สถานะ Active/Inactive

### 6.3 Master Data

**เมนู:** Dashboard → ตั้งค่า

| ประเภท | คำอธิบาย |
|--------|----------|
| หมวดหมู่สินค้า | ฟิลเลอร์, โบท็อกซ์, ฯลฯ |
| หน่วยนับ | ชิ้น, กล่อง, ขวด |
| วิธีจัดส่ง | รถบริษัท, ขนส่งเอกชน |
| คลังสินค้า | คลังกลาง, คลังสาขา |

### 6.4 ดู Event Logs

**เมนู:** Dashboard → Event Logs

**ประเภท Events:**
| Event | คำอธิบาย |
|-------|----------|
| INBOUND | รับสินค้าเข้าคลัง |
| OUTBOUND | สร้างใบส่งออก |
| APPROVE | อนุมัติใบส่งออก |
| REJECT | ปฏิเสธใบส่งออก |
| SCAN | สแกน QR ตรวจสอบ |
| ACTIVATE | ลูกค้า Activate |
| REPRINT | พิมพ์ QR ใหม่ |
| RETURN | รับคืนสินค้า |

**Filter ได้ตาม:**
- ประเภท Event
- Serial Number
- ช่วงวันที่

---

## 7. สำหรับคลินิก/ลูกค้า (Public)

### 7.1 ตรวจสอบความแท้ (Verify)

**URL:** สแกน QR Code บนสินค้า หรือเข้า `http://localhost:3000/th/verify`

**ผลลัพธ์ที่เป็นไปได้:**

| สถานะ | ความหมาย | สี |
|-------|----------|-----|
| GENUINE_IN_STOCK | ของแท้ - อยู่ในคลัง | เขียว |
| GENUINE_SHIPPED | ของแท้ - ส่งออกแล้ว | เขียว |
| GENUINE_ACTIVATED | ของแท้ - ถูก Activate แล้ว | เหลือง |
| GENUINE_RETURNED | ของแท้ - ถูกส่งคืนแล้ว | เหลือง |
| TOKEN_REVOKED | Token ถูกยกเลิก (มี QR ใหม่) | แดง |
| INVALID | ไม่พบในระบบ / ของปลอม | แดง |

**ข้อมูลที่แสดง:**
- Serial Number
- ชื่อสินค้า / SKU
- หมวดหมู่
- วันหมดอายุ
- สถานะปัจจุบัน
- ข้อมูล Activation (ถ้ามี)

### 7.2 ลงทะเบียนสินค้า (Activate)

**URL:** หลังจากสแกน QR → กดปุ่ม "ลงทะเบียน"

**ข้อมูลที่ต้องกรอก:**
- ชื่อ-นามสกุล
- เบอร์โทรศัพท์
- อีเมล (ไม่บังคับ)
- ☑️ ยินยอม PDPA

**ข้อจำกัด:**
- Activate ได้ครั้งเดียว (One-Time Lock)
- เฉพาะสินค้าสถานะ `SHIPPED` เท่านั้น
- ต้องยินยอม PDPA

**ผลลัพธ์:**
- สินค้าเปลี่ยนเป็น `ACTIVATED`
- บันทึกข้อมูลผู้ Activate
- แสดงหน้ายืนยันสำเร็จ

---

## 8. API Reference

### Authentication
```
POST /api/auth/login     - เข้าสู่ระบบ
POST /api/auth/logout    - ออกจากระบบ
GET  /api/auth/me        - ข้อมูลผู้ใช้ปัจจุบัน
```

### Public APIs
```
GET  /api/public/verify?token=xxx   - ตรวจสอบ QR Token
POST /api/public/activate           - ลงทะเบียนสินค้า
```

### Warehouse APIs
```
GET  /api/warehouse/products        - รายการสินค้า
GET  /api/warehouse/grn             - รายการ GRN
POST /api/warehouse/grn             - สร้าง GRN
GET  /api/warehouse/grn/[id]        - รายละเอียด GRN
GET  /api/warehouse/outbound        - รายการใบส่งออก
POST /api/warehouse/outbound        - สร้างใบส่งออก
GET  /api/warehouse/outbound/[id]   - รายละเอียดใบส่งออก
PATCH /api/warehouse/outbound/[id]  - อัปเดต/ยกเลิกใบส่งออก
POST /api/warehouse/labels          - สร้าง PDF Labels
GET  /api/warehouse/reprint         - รายการสินค้าที่พิมพ์ใหม่ได้
POST /api/warehouse/reprint         - พิมพ์ QR ใหม่
GET  /api/warehouse/return          - รายการสินค้าที่คืนแล้ว
POST /api/warehouse/return          - บันทึกการคืนสินค้า
```

### Manager APIs
```
GET  /api/manager/approval-board    - รายการรออนุมัติ
PATCH /api/warehouse/outbound/[id]  - อนุมัติ/ปฏิเสธ (action: approve/reject)
```

### Admin APIs
```
GET  /api/admin/users               - รายการผู้ใช้
POST /api/admin/users               - เพิ่มผู้ใช้
GET  /api/admin/users/[id]          - รายละเอียดผู้ใช้
PATCH /api/admin/users/[id]         - แก้ไขผู้ใช้
DELETE /api/admin/users/[id]        - ลบผู้ใช้
GET  /api/admin/clinics             - รายการคลินิก
POST /api/admin/clinics             - เพิ่มคลินิก
GET  /api/admin/clinics/[id]        - รายละเอียดคลินิก
PATCH /api/admin/clinics/[id]       - แก้ไขคลินิก
DELETE /api/admin/clinics/[id]      - ลบคลินิก
GET  /api/admin/event-logs          - Event Logs
GET  /api/admin/masters/categories  - หมวดหมู่สินค้า
GET  /api/admin/masters/units       - หน่วยนับ
GET  /api/admin/masters/shipping-methods - วิธีจัดส่ง
GET  /api/admin/masters/warehouses  - คลังสินค้า
```

---

## สถานะสินค้า (Product Status)

```
IN_STOCK → PENDING_OUT → SHIPPED → ACTIVATED
                ↓                      ↓
            (ปฏิเสธ)               RETURNED
                ↓
            IN_STOCK
```

| สถานะ | คำอธิบาย |
|-------|----------|
| IN_STOCK | อยู่ในคลัง พร้อมขาย |
| PENDING_OUT | รอการอนุมัติส่งออก |
| SHIPPED | ส่งออกแล้ว |
| ACTIVATED | ลูกค้าลงทะเบียนแล้ว |
| RETURNED | ถูกส่งคืนแล้ว |

---

## Token Status

| สถานะ | คำอธิบาย |
|-------|----------|
| ACTIVE | ใช้งานได้ |
| REVOKED | ถูกยกเลิก (มี Token ใหม่แทน) |

---

## ติดต่อสอบถาม

หากพบปัญหาหรือมีข้อสงสัย กรุณาติดต่อทีมพัฒนา

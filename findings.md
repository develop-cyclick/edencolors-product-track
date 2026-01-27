# Findings & Decisions

## Requirements Summary

### Roles & Permissions
| Role | สิทธิ์ |
|------|-------|
| Public | ไม่ต้องล็อกอิน, สแกน Verify/Activate, เห็นข้อมูลจำกัด |
| Warehouse | GRN, พิมพ์ QR, Outbound request, รับคืน, Reprint |
| Manager | Approval Board (อนุมัติ/ปฏิเสธ Outbound) |
| Admin | จัดการ Clinics, Users, Master Data, ตั้งค่าระบบ |

### Main Flows
1. **Inbound → Outbound → Verify → Activate**
   - Warehouse รับสินค้า → สร้าง GRN → ระบบสร้าง Serial + QR token
   - Warehouse สร้าง Outbound request → Manager อนุมัติ
   - คลินิก/ลูกค้าสแกน QR → เห็นผลทันที (Public)
   - ลูกค้า Activate → กรอกฟอร์ม + consent → ล็อก 1 ครั้ง

2. **Return (minimal)**
   - Warehouse รับคืน → เปลี่ยนสถานะ RETURNED
   - ยังไม่ลบข้อมูล, มี event log

3. **Reprint**
   - ออก token version ใหม่ + revoke token เก่า
   - สแกน token เก่าจะขึ้น "Reprinted/Replaced"

### Data Models (PostgreSQL)
- `users` - username, password_hash, role, is_active, force_pw_change
- `clinics` - clinic_name, province, branch_name, is_active
- `product_items` - serial12 (unique), sku, name, category, model_size, lot, mfg_date, exp_date, status, assigned_clinic_id
- `qr_tokens` - product_item_id, token_version, token_hash, status, issued_at, revoked_at, reason
- `grn_headers` + `grn_lines` - ใบรับสินค้า
- `outbound_headers` + `outbound_lines` - ใบส่งสินค้า + สถานะ approval
- `activations` - product_item_id, name, age, gender, province, phone, consent_at, policy_version
- `scan_logs` - token_version, result, scanned_at, ip_hash
- `event_logs` - audit trail
- Master tables: `product_categories`, `units`, `shipping_methods`, `warehouses`

### Key Constraints
- `serial12` = 12 digits, unique, auto-running
- `qr_tokens` unique on (product_item_id, token_version)
- Sequence running ต้อง atomic (transaction/row lock)

## Research Findings

### GRN Required Fields
- เลขที่ใบรับสินค้า (GRN No.) - auto running
- วันที่รับสินค้า
- พนักงานตรวจรับ
- สาขา/คลังสินค้า
- PO No.
- ชื่อผู้ขาย/บริษัทผู้จัดส่ง
- Delivery Note No.
- ที่อยู่ผู้จัดส่ง (รวมเบอร์โทร + ชื่อผู้รับ)
- วันที่ออกเอกสารส่งสินค้า
- Item Code/SKU
- Item Name
- ประเภทสินค้า/หมวดหมู่ (Dropdown)
- รุ่น/ขนาด/ปริมาณบรรจุ
- Quantity Received
- Unit (Dropdown)
- Lot/Batch
- MFG/EXP (DD/MM/YY)
- สถานะตรวจสินค้า
- หมายเหตุ
- ผู้อนุมัติ/ผู้จัดการคลัง
- วันที่อนุมัติ

### Outbound Required Fields
- Delivery Note No.
- วันที่ส่งสินค้า
- ผู้จัดส่ง/ผู้ตรวจออกสินค้า
- สาขา/คลังต้นทาง
- วิธีการส่ง (Dropdown)
- ชื่อพนักงานขาย
- ช่องทางติดต่อกลับบริษัท
- ชื่อคลินิก/ลูกค้า
- ที่อยู่คลินิก
- เบอร์โทร/อีเมล
- PO No.
- รายการสินค้า (SKU/ชื่อ/หมวด/รุ่น-ขนาด/lot/exp/จำนวน/unit)
- สถานะสินค้า
- ผู้อนุมัติ (Manager)
- หมายเหตุ

### Default Seed Data
- **Product Categories:** ฟิลเลอร์, เมโส, สกินแคร์, ยา, เครื่องมือแพทย์, เครื่องสำอาง, อื่นๆ
- **Units:** ชิ้น, กล่อง, ขวด, ซอง, หลอด, เส้น, ชุด, แพ็ก
- **Shipping Methods:** GRAB, ปณ, Inter express, ผู้แทน, Messenger, รับเองที่คลัง

### Public Verify Result Codes
- GENUINE_IN_STOCK
- GENUINE_SHIPPED
- ACTIVATED
- RETURNED
- REPRINTED (token เก่า)
- INVALID_TOKEN
- NOT_FOUND
- REVOKED

### PDF Label 4x6
- ขนาด 101.6 x 152.4 mm
- 1 หน้า = 1 Serial
- เนื้อหา: QR + Serial 12 หลัก
- Safe margin 4-6 mm
- พิมพ์ Actual size 100%

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Next.js API Routes | ใช้ Next.js เดียวทั้ง frontend + backend (ง่ายกว่า monorepo) |
| Next.js App Router | i18n via /th/... และ /en/... segments |
| Prisma | Type-safe ORM + migrations |
| JOSE/JWE | Signed/Encrypted QR token ตาม PRD |
| httpOnly cookie | Same-origin auth, no CORS issues |
| Docker Compose | next (3000) + postgres (5432) + redis (6379) |
| ngrok for mobile | HTTPS tunnel สำหรับทดสอบกล้องบนมือถือ |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| verifyJWT not exported from auth.ts | Function is named verifyToken - fixed imports |
| withRoles(handler, roles) wrong order | Fixed to withRoles(roles, handler) |
| errors.internal() doesn't exist | Changed to errors.internalError() |
| Buffer not compatible with NextResponse | Convert to Uint8Array |

## Resources
- PRD: QR_Project_PRD_THA_v1.pdf
- Stack: Next.js 16 + Express + PostgreSQL
- Deployment: Docker Compose

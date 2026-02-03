# Changelog
## QR Authenticity & Activation System

**เวอร์ชันปัจจุบัน:** 2.0
**อัพเดตล่าสุด:** กุมภาพันธ์ 2026

---

## v2.0 - Major Update (กุมภาพันธ์ 2026)

### New Features

#### 1. Pre-Generate QR Codes
- สร้าง QR Codes ล่วงหน้าเป็น Batch
- สินค้ามีสถานะ `PENDING_LINK` รอเชื่อมโยง
- สแกน QR เพื่อ link กับสินค้าจริงตอนรับเข้าคลัง
- เลข Batch: `PG-YYYY-NNNNNN`

#### 2. Product Master (แคตาล็อกสินค้า)
- เก็บข้อมูลสินค้าหลัก (Template)
- รองรับรูปภาพสินค้า
- กำหนดประเภท Activation (SINGLE/PACK)
- กำหนดจำนวน Activation สูงสุด

#### 3. Pack Activation
- สินค้าประเภท PACK activate ได้หลายครั้ง
- นับจำนวน `activation_count`
- เหมาะสำหรับสินค้าที่ใช้ร่วมกัน (เช่น กล่องที่มีหลายชิ้น)

#### 4. Purchase Order (ใบสั่งซื้อ)
- ระบบใบสั่งซื้อ/สั่งฝากสินค้า
- เชื่อมโยงกับ Clinic
- ติดตามสถานะการส่ง (DRAFT → CONFIRMED → PARTIAL → COMPLETED)
- อ้างอิงจาก Outbound

#### 5. System Settings
- ตั้งค่าระบบผ่าน UI
- `verify.showClinicInfo` - แสดง/ซ่อนข้อมูลคลินิก
- `activation.requireCustomerInfo` - บังคับ/ไม่บังคับกรอกข้อมูล

#### 6. Damaged Products Management
- สถานะใหม่ `DAMAGED`
- หน้าจัดการสินค้าเสียหาย
- แยกจาก Return workflow

#### 7. Short URL for QR
- รูปแบบใหม่: `/v/{serial12}`
- สั้นลงจากเดิมที่ใช้ token ใน URL
- รองรับ URL เดิม (backward compatible)

---

### Database Changes

#### New Tables
| Table | Purpose |
|-------|---------|
| `product_masters` | แคตาล็อกสินค้าหลัก |
| `pre_generated_batches` | Batch สำหรับ Pre-gen QR |
| `purchase_orders` | ใบสั่งซื้อ Header |
| `purchase_order_lines` | ใบสั่งซื้อ Lines |
| `system_settings` | การตั้งค่าระบบ |

#### New Enums
| Enum | Values |
|------|--------|
| `ActivationType` | SINGLE, PACK |
| `POStatus` | DRAFT, CONFIRMED, PARTIAL, COMPLETED, CANCELLED |

#### Modified Tables

**ProductItem:**
- เพิ่ม `product_master_id` - อ้างอิง Product Master
- เพิ่ม `activation_count` - นับจำนวน activation
- เพิ่ม `pre_generated_batch_id` - อ้างอิง Pre-Gen Batch

**ProductStatus (enum):**
- เพิ่ม `PENDING_LINK` - รอเชื่อมโยง
- เพิ่ม `DAMAGED` - เสียหาย

**Activation:**
- เพิ่ม `activation_number` - ลำดับการ activate (สำหรับ PACK)
- ข้อมูลลูกค้าเปลี่ยนเป็น optional ทั้งหมด

**OutboundHeader:**
- เพิ่ม `contract_no` - เลขที่สัญญา
- เพิ่ม `purchase_order_id` - อ้างอิง PO

---

### API Changes

#### New Endpoints
```
# Pre-Generate
GET    /api/warehouse/pre-generate
POST   /api/warehouse/pre-generate
GET    /api/warehouse/pre-generate/available
POST   /api/warehouse/pre-generate/scan
GET    /api/warehouse/pre-generate/{id}
PUT    /api/warehouse/pre-generate/{id}

# Damaged Products
GET    /api/warehouse/damaged
POST   /api/warehouse/damaged
GET    /api/warehouse/damaged/{id}
PUT    /api/warehouse/damaged/{id}

# Product Masters
GET    /api/admin/masters/products
POST   /api/admin/masters/products
GET    /api/admin/masters/products/{id}
PUT    /api/admin/masters/products/{id}

# Purchase Orders
GET    /api/admin/purchase-orders
POST   /api/admin/purchase-orders
GET    /api/admin/purchase-orders/{id}
PUT    /api/admin/purchase-orders/{id}

# System Settings
GET    /api/admin/system-settings
PUT    /api/admin/system-settings

# File Upload
POST   /api/admin/upload

# Short URL Verify
GET    /v/{serial}
```

#### Modified Endpoints

**POST /api/public/activate:**
- รองรับ PACK activation
- ข้อมูลลูกค้าเป็น optional

**GET /api/public/verify:**
- รองรับ query by serial (ใหม่)
- เพิ่มข้อมูล activationType, maxActivations, activationCount, canActivate

---

### Tech Stack Updates

| Component | v1.0 | v2.0 |
|-----------|------|------|
| Next.js | 15 | **16** |
| React | 18 | **19.2.3** |
| Tailwind CSS | 3.x | **4.x** |
| Prisma | 5.x | **6.19.2** |
| jose | 5.x | **6.1.3** |

---

### UI/UX Improvements

1. **Dashboard Sidebar**
   - Role-based menu filtering
   - Collapsible navigation
   - Mobile responsive overlay
   - User badge with role

2. **QR Scanner**
   - Improved camera permissions handling
   - File upload fallback
   - Better error messages

3. **Forms**
   - Better validation
   - Loading states
   - Success/Error toasts

4. **PDF Labels**
   - Thai font support (Sarabun)
   - Improved layout
   - Product image support (optional)

---

### Security Improvements

1. **Rate Limiting**
   - Configurable presets
   - Per-IP tracking

2. **Token Security**
   - Serial-based verification (simpler, more secure)
   - Version tracking for reprints

3. **Audit Trail**
   - More event types
   - JSON details field

---

## v1.0 - Initial Release (มกราคม 2026)

### Core Features
- User Authentication (JWT)
- Role-Based Access Control (ADMIN, MANAGER, WAREHOUSE)
- GRN (Goods Receipt Note)
- Outbound with Approval Workflow
- Manager Approval Board
- Product Verification (Public)
- Product Activation (One-Time Lock)
- PDPA Consent Recording
- PDF Label Generation (4x6 inch)
- QR Reprint with Version Control
- Product Return Management
- Clinic Management
- User Management
- Master Data Management
- Event Logging
- i18n Support (TH/EN)

### Tech Stack
- Next.js 15
- React 18
- TypeScript
- Tailwind CSS 3.x
- PostgreSQL
- Prisma 5.x
- jose (JWT/JWE)
- Docker Compose

---

## Migration Guide (v1.0 → v2.0)

### Database Migration

1. **Backup existing data:**
```bash
pg_dump -h localhost -U postgres edencolors > backup.sql
```

2. **Generate new Prisma client:**
```bash
npm run db:generate
```

3. **Push schema changes:**
```bash
npm run db:push
```

4. **Run seed for new master data (optional):**
```bash
npm run db:seed
```

### Code Changes

1. **Update dependencies:**
```bash
npm install
```

2. **Environment variables:**
No new required variables

3. **API consumers:**
- Verify endpoint now supports `?serial=` query param
- Activate endpoint customer info is now optional
- New response fields for activation type

---

## Known Issues

1. **Thai font in PDF** - บางกรณีฟอนต์ไทยอาจแสดงไม่ถูกต้อง
2. **Rate limiting** - In-memory (resets on restart)
3. **File upload** - ขนาดจำกัด 5MB

---

## Roadmap (Planned)

- [ ] Dashboard Analytics & Reports
- [ ] Batch QR Printing Optimization
- [ ] Push Notifications for Approvals
- [ ] Mobile App (React Native)
- [ ] Integration with ERP/Accounting Systems
- [ ] Redis-based Rate Limiting
- [ ] Image CDN Integration

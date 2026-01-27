# Task Plan: QR Authenticity & Activation System (MVP)

## Goal
สร้างระบบเว็บสำหรับติดตามและยืนยันความแท้ของสินค้าด้วย QR Code + Serial 12 หลัก รองรับ flow: รับเข้าคลัง → ส่งออก (Manager อนุมัติ) → คลินิกตรวจแท้ → ลูกค้า Activate

## Tech Stack
- **Frontend + Backend:** Next.js 16 App Router + API Routes + TypeScript + Tailwind CSS v4
- **Database:** PostgreSQL + Prisma ORM (via Docker)
- **Cache:** Redis (via Docker)
- **Auth:** Cookie-based (httpOnly) + RBAC
- **QR Token:** JOSE/JWE (Signed/Encrypted)
- **Deployment:** Docker Compose (next + postgres + redis)
- **i18n:** TH/EN

## Current Phase
✅ ALL PHASES COMPLETE - MVP + UAT DONE!

## Phases

### Phase 1: Sprint 0 - Project Setup
- [x] สร้าง Docker Compose (postgres + redis)
- [x] Setup Prisma schema + migrations
- [x] สร้าง API routes structure (/api/...)
- [x] Seed data (admin user, default master data)
- [x] ทดสอบ Docker + Database connection
- **Status:** complete

### Phase 2: Sprint 1 - Auth/RBAC + Admin
- [x] Login/Logout API (httpOnly cookie)
- [x] Middleware guard (role-based)
- [x] Admin: Clinic CRUD
- [x] Admin: User management (add/disable/reset password)
- [x] Admin: Master Data CRUD (categories, units, shipping methods)
- [x] i18n skeleton (TH/EN)
- **Status:** complete

### Phase 3: Sprint 2 - QR + Public Verify
- [x] QR token generation (JOSE/JWE)
- [x] Serial 12 digits auto-running
- [x] GET /api/public/verify endpoint
- [x] Public verify UI (TH/EN)
- [x] Rate limiting
- [x] Scan logging
- **Status:** complete

### Phase 4: Sprint 3 - GRN + Outbound + Board
- [x] GRN form (all required fields)
- [x] GRN line items + Serial + Token creation
- [x] Outbound request form
- [x] Manager Approval Board UI
- [x] Approve/Reject API
- **Status:** complete

### Phase 5: Sprint 4 - Activation + PDF Label
- [x] Activation form (TH/EN) + PDPA consent
- [x] One-time activation lock
- [x] PDF 4x6 label generation (1 serial/page)
- [x] Print guidance
- **Status:** complete

### Phase 6: Sprint 5 - Reprint + Return
- [x] Reprint with token versioning
- [x] Revoke old token
- [x] Return status change
- [x] Event/Audit logs
- **Status:** complete

### Phase 7: Testing & UAT
- [x] Login/Role testing (Admin, Warehouse, Manager + RBAC)
- [x] GRN flow testing (Create GRN → Serial → QR Token)
- [x] Outbound → Approve → Verify flow
- [x] Activation lock testing (one-time lock)
- [x] Reprint token versioning (revoke old + new version)
- [x] PDF print + scan testing (965KB valid PDF)
- [x] Return flow testing (SHIPPED/ACTIVATED → RETURNED)
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Next.js API Routes (ไม่แยก Express) | ง่ายกว่า monorepo, same-origin auth |
| JOSE/JWE for QR token | กัน token ปลอม/เดา ตาม PRD |
| Cookie-based auth | Same domain ไม่มีปัญหา CORS |
| Prisma 6 ORM | Type-safe + migrations (Prisma 7 มี breaking changes) |
| i18n via URL segment | /th/... และ /en/... ตาม PRD |
| Docker for DB only | Run Next.js locally, DB via Docker |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| Prisma 7 breaking changes | Downgraded to Prisma 6 for stability |
| verifyJWT import error | Changed to verifyToken |
| withRoles argument order | Fixed to withRoles(roles, handler) |
| API returns empty `{}` | Remove double-wrapping `NextResponse.json(successResponse(...))` |
| `user.id` undefined in handlers | Change to `user.userId` from JWTPayload |
| Handler missing context | Add `context: HandlerContext` parameter |
| Syntax error in outbound/[id] | Rewrite file with correct patterns |

## Test Summary (Phase 7)
| Test Category | Result |
|--------------|--------|
| Login/Role Testing | ✅ Pass |
| GRN Flow Testing | ✅ Pass |
| Outbound → Approve → Verify | ✅ Pass |
| Activation Lock Testing | ✅ Pass |
| Reprint Token Versioning | ✅ Pass |
| PDF Label Testing | ✅ Pass |
| Return Flow Testing | ✅ Pass |

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**QR Authenticity & Activation System** - ระบบติดตามและยืนยันความแท้ของสินค้าด้วย QR Code + Serial 12 หลัก

**Stack:** Next.js 16 + TypeScript + Tailwind CSS v4 + PostgreSQL + Prisma + Redis

## Commands

### Development
- `npm run dev` - Start development server at localhost:3000
- `npm run build` - Create production build
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Docker & Database
- `npm run db:up` - Start PostgreSQL + Redis containers
- `npm run db:down` - Stop containers
- `npm run db:logs` - View container logs
- `npm run db:migrate` - Run Prisma migrations
- `npm run db:push` - Push schema to database (dev)
- `npm run db:seed` - Seed database with initial data
- `npm run db:studio` - Open Prisma Studio GUI
- `npm run db:reset` - Reset database and re-seed
- `npm run db:generate` - Generate Prisma client

## Quick Start

```bash
# 1. Start database
npm run db:up

# 2. Generate Prisma client + push schema
npm run db:generate
npm run db:push

# 3. Seed database
npm run db:seed

# 4. Start development server
npm run dev
```

## Architecture

```
/app
  /api                  # API Routes (Next.js Route Handlers)
    /auth               # Authentication endpoints
    /public             # Public endpoints (verify, activate)
    /grn                # GRN endpoints (Sprint 3)
    /outbound           # Outbound endpoints (Sprint 3)
    /admin              # Admin endpoints (Sprint 1)
    /warehouse          # Warehouse endpoints (Sprint 5)
    /manager            # Manager endpoints (Sprint 3)
  /[locale]             # i18n routes (TH/EN) - Sprint 1
  layout.tsx
  page.tsx
/lib
  prisma.ts             # Prisma client singleton
/prisma
  schema.prisma         # Database schema
  seed.ts               # Seed data script
```

## Key Configuration

- **Path alias**: `@/*` maps to project root
- **Database**: PostgreSQL via Docker (port 5432)
- **Redis**: via Docker (port 6379)
- **Prisma**: ORM with TypeScript types

## Test Accounts (after seeding)

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin123 |
| Warehouse | warehouse1 | warehouse123 |
| Manager | manager1 | manager123 |


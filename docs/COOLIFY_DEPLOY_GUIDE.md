# 🚀 EdenColors — Coolify Deployment Guide
## คู่มือ Deploy ตั้งแต่เครื่องใหม่ จนรันได้สมบูรณ์

> **เป้าหมาย:** อ่าน Guide นี้แล้ว AI (หรือคน) สามารถรัน command ตามลำดับได้เลย
> **Stack:** Next.js 16 + PostgreSQL 16 + Redis 7 + Nginx + Coolify
> **วิธี deploy:** GitHub → Docker Hub → Coolify (Self-hosted PaaS)

---

## 📋 สารบัญ

1. [ภาพรวม Architecture](#1-architecture)
2. [เตรียมเครื่อง Dev (Notebook ใหม่)](#2-dev-setup)
3. [เตรียม GitHub Repository](#3-github)
4. [เตรียม Docker Hub](#4-docker-hub)
5. [เตรียม Server สำหรับ Coolify](#5-server-setup)
6. [ติดตั้ง Coolify](#6-install-coolify)
7. [ตั้งค่า Coolify (Web UI)](#7-coolify-config)
8. [ตั้งค่า Environment Variables](#8-env-setup)
9. [Deploy Project](#9-deploy)
10. [ตั้งค่า Domain + SSL](#10-domain-ssl)
11. [Database Migration](#11-database)
12. [ทดสอบ & Verify](#12-verify)
13. [Update / Redeploy](#13-update)
14. [Troubleshooting](#14-troubleshoot)

---

## 1. Architecture

```
Developer Machine
  └── git push → GitHub (source code)
  └── docker build + push → Docker Hub (image)

Internet → Domain (DNS) → Server IP
                              └── Coolify (port 8000, admin UI)
                                    ├── Nginx (port 80/443, reverse proxy + SSL)
                                    ├── Next.js App (port 3000, internal)
                                    ├── PostgreSQL 16 (port 5432, internal)
                                    └── Redis 7 (port 6379, internal)
```

**ไฟล์สำคัญที่ใช้:**
- `docker-compose.prod.yml` → Coolify อ่านไฟล์นี้เพื่อรัน services
- `.env.production` → Environment variables (ไม่ commit ขึ้น git)
- `nginx.conf` → Nginx config (อยู่ใน repo)
- `Dockerfile` → Build image (multi-stage, standalone)

---

## 2. เตรียมเครื่อง Dev (Notebook ใหม่)

### 2.1 ติดตั้ง Prerequisites

```bash
# Windows: ดาวน์โหลดและติดตั้ง
# 1. Git: https://git-scm.com/download/win
# 2. Node.js 22 LTS: https://nodejs.org
# 3. Docker Desktop: https://www.docker.com/products/docker-desktop

# ตรวจสอบว่าติดตั้งสำเร็จ
git --version          # ควรได้ git version 2.x.x
node --version         # ควรได้ v22.x.x
npm --version          # ควรได้ 10.x.x
docker --version       # ควรได้ Docker version 27.x.x
docker compose version # ควรได้ Docker Compose version v2.x.x
```

### 2.2 Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/edencolors.git
cd edencolors
```

### 2.3 ติดตั้ง Dependencies

```bash
npm install
```

### 2.4 ตั้งค่า Local Environment

```bash
# Copy template
copy .env.example .env

# แก้ไขค่าใน .env ถ้าต้องการ (ค่า default ใช้ได้กับ docker local แล้ว)
```

### 2.5 รัน Development

```bash
# Start PostgreSQL + Redis ด้วย Docker
npm run db:up

# รอ ~10 วินาที แล้วรัน migration
npm run db:migrate

# Seed ข้อมูลเริ่มต้น
npm run db:seed

# Start dev server
npm run dev
# เปิด http://localhost:3000
```

---

## 3. เตรียม GitHub Repository

### 3.1 สร้าง Repository บน GitHub

```
1. ไปที่ https://github.com/new
2. Repository name: edencolors
3. Visibility: Private (แนะนำ)
4. ไม่ต้อง initialize (เพราะมี code อยู่แล้ว)
5. กด "Create repository"
```

### 3.2 Push Code ขึ้น GitHub

```bash
# ใน folder edencolors
git remote add origin https://github.com/YOUR_USERNAME/edencolors.git

# ตรวจสอบว่า .env ไม่ติดไปด้วย
git status   # ต้องไม่เห็น .env หรือ .env.production

# Push
git branch -M main
git push -u origin main
```

### 3.3 ตรวจสอบบน GitHub

```
✅ ต้องมี:  Dockerfile, docker-compose.prod.yml, nginx.conf, .env.example
❌ ต้องไม่มี: .env, .env.production, node_modules/, .next/
```

---

## 4. เตรียม Docker Hub

### 4.1 สร้าง Account และ Repository

```
1. สร้าง account: https://hub.docker.com/signup
2. สร้าง repository: https://hub.docker.com/repository/create
   - Repository name: edencolors
   - Visibility: Private
```

### 4.2 Login Docker และ Build Image (เครื่อง Dev)

```bash
# Login Docker Hub
docker login
# กรอก Username และ Password

# Build image สำหรับ Linux (server ส่วนใหญ่เป็น amd64)
docker build --platform linux/amd64 -t YOUR_DOCKERHUB_USERNAME/edencolors:latest .

# Push ขึ้น Docker Hub
docker push YOUR_DOCKERHUB_USERNAME/edencolors:latest

# ตรวจสอบว่า push สำเร็จ
# ไปดูที่ https://hub.docker.com/r/YOUR_DOCKERHUB_USERNAME/edencolors
```

### 4.3 สร้าง Access Token สำหรับ Coolify

```
1. ไปที่ https://hub.docker.com/settings/security
2. กด "New Access Token"
3. Access Token Description: "coolify-edencolors"
4. Permissions: Read, Write, Delete
5. กด "Generate"
6. COPY TOKEN ทันที (จะดูได้แค่ครั้งเดียว!)
7. บันทึกไว้: DOCKER_HUB_TOKEN=xxxxxxxxxxxxxxxx
```

---

## 5. เตรียม Server สำหรับ Coolify

### 5.1 Spec แนะนำขั้นต่ำ

```
OS:   Ubuntu 22.04 LTS หรือ 24.04 LTS (64-bit)
CPU:  2 vCPU
RAM:  2 GB (แนะนำ 4 GB)
Disk: 20 GB SSD
Port: 22 (SSH), 80 (HTTP), 443 (HTTPS), 8000 (Coolify UI)
```

**Provider แนะนำ (ราคาถูก):**
- DigitalOcean Droplet: ~$12/เดือน (2GB RAM)
- Vultr: ~$12/เดือน
- Hetzner (EU): ~€5/เดือน (ถูกที่สุด)
- หรือ server เครื่องเองที่บ้าน/ออฟฟิศ

### 5.2 ตั้งค่า Server เบื้องต้น

```bash
# SSH เข้า server
ssh root@YOUR_SERVER_IP

# Update system
apt update && apt upgrade -y

# ตั้ง timezone
timedatectl set-timezone Asia/Bangkok

# ตรวจสอบ timezone
date
```

### 5.3 เปิด Firewall

```bash
# ติดตั้ง ufw
apt install ufw -y

# กำหนด rules
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 8000/tcp  # Coolify UI

# เปิดใช้งาน
ufw enable
ufw status
```

---

## 6. ติดตั้ง Coolify

### 6.1 ติดตั้ง Coolify ด้วยคำสั่งเดียว

```bash
# SSH เข้า server ก่อน
ssh root@YOUR_SERVER_IP

# รันคำสั่งติดตั้ง Coolify (ใช้เวลา ~3-5 นาที)
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

**สิ่งที่ script นี้ทำอัตโนมัติ:**
- ติดตั้ง Docker + Docker Compose
- ดาวน์โหลด Coolify containers
- ตั้งค่า Coolify service

### 6.2 รอ Coolify พร้อม

```bash
# ตรวจสอบสถานะ containers
docker ps

# ควรเห็น containers เหล่านี้:
# coolify, coolify-proxy, coolify-db, coolify-redis, coolify-realtime

# ดู logs ถ้าต้องการ
docker logs coolify -f
```

### 6.3 เข้า Coolify Web UI

```
เปิด browser ไปที่: http://YOUR_SERVER_IP:8000

ครั้งแรก: สร้าง Admin Account
- Full Name: ชื่อของคุณ
- Email: อีเมลของคุณ
- Password: ตั้ง password แข็งแรง (อย่างน้อย 12 ตัวอักษร)
กด "Register"
```

---

## 7. ตั้งค่า Coolify (Web UI)

### 7.1 เพิ่ม Server

```
1. ไปที่ Servers → Add Server
2. เลือก "localhost" (เพราะ Coolify อยู่บน server เดียวกัน)
3. กด "Save"
4. กด "Validate & Test" — ควรขึ้น "Connected"
```

### 7.2 สร้าง Project

```
1. ไปที่ Projects → New Project
2. Name: edencolors
3. กด "Create"
```

### 7.3 เพิ่ม Docker Registry (Docker Hub)

```
1. ไปที่ Settings → Registries → Add Registry
2. เลือก "Docker Hub"
3. กรอก:
   - Username: YOUR_DOCKERHUB_USERNAME
   - Password/Token: (ใส่ Access Token ที่สร้างไว้ใน Step 4.3)
4. กด "Save"
```

### 7.4 เชื่อม GitHub (สำหรับ Auto-deploy)

```
1. ไปที่ Settings → Source → Add Source
2. เลือก "GitHub App"
3. กด "Register GitHub App"
4. ทำตามขั้นตอนบน GitHub
5. Install App ที่ Repository: edencolors
6. กลับมา Coolify — ควรเห็น GitHub connected
```

---

## 8. ตั้งค่า Environment Variables

### 8.1 สร้างไฟล์ .env.production บน Server

```bash
# SSH เข้า server
ssh root@YOUR_SERVER_IP

# สร้าง folder
mkdir -p /root/edencolors
cd /root/edencolors

# สร้างไฟล์ .env.production
nano .env.production
```

### 8.2 เนื้อหา .env.production (แก้ค่าทั้งหมดที่มี CHANGE_ME)

```env
# =================================
# EdenColors Production Environment
# =================================

# Database
DB_PASSWORD=XXXXXXXXXXXXXXXX
DATABASE_URL=postgresql://edencolors:XXXXXXXXXXXXXXXX@postgres:5432/edencolors?schema=public

# Redis
REDIS_URL=redis://redis:6379

# Auth Secrets (generate each with: openssl rand -hex 32)
JWT_SECRET=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
COOKIE_SECRET=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
QR_TOKEN_SECRET=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# App URL (ใส่ domain จริง หรือ IP ชั่วคราว)
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production

# Cloudflare R2 (ถ้าใช้ — ไว้เก็บรูปภาพ)
R2_ACCESS_KEY_ID=CHANGE_ME
R2_SECRET_ACCESS_KEY=CHANGE_ME
R2_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
R2_BUCKET_NAME=edencolors-assets
R2_PUBLIC_URL=https://pub-xxx.r2.dev
```

### 8.3 Generate Secrets

```bash
# รันคำสั่งนี้ 3 ครั้ง เพื่อ generate JWT_SECRET, COOKIE_SECRET, QR_TOKEN_SECRET
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 32

# แต่ละ output นำไปใส่แต่ละ secret
```

### 8.4 ตั้งค่า DB_PASSWORD

```bash
# Generate password แข็งแรง
openssl rand -base64 24
# ตัวอย่าง output: X9kP2mNqR7vL5wY3hJ8cA1sE=
# นำไปใส่ DB_PASSWORD และ DATABASE_URL (แทน XXXXXXXX)
```

---

## 9. Deploy Project ใน Coolify

### 9.1 สร้าง Service ใหม่

```
1. ไปที่ Projects → edencolors → Production
2. กด "+ New Resource"
3. เลือก "Docker Compose"
4. เลือก Source: "GitHub" (ถ้าเชื่อมไว้) หรือ "URL"
5. เลือก Repository: edencolors
6. Branch: main
7. Docker Compose Location: ./docker-compose.prod.yml
8. กด "Save"
```

### 9.2 ตั้งค่า Environment Variables ใน Coolify UI

```
1. ไปที่ Service → Environment Variables
2. กด "Import .env file"
3. วางเนื้อหาจาก .env.production
4. กด "Save"

หรือใส่ทีละตัว:
- DB_PASSWORD          = (ค่าที่ generate ไว้)
- DATABASE_URL         = postgresql://edencolors:DB_PASSWORD@postgres:5432/edencolors?schema=public
- REDIS_URL            = redis://redis:6379
- JWT_SECRET           = (ค่าที่ generate ไว้)
- COOKIE_SECRET        = (ค่าที่ generate ไว้)
- QR_TOKEN_SECRET      = (ค่าที่ generate ไว้)
- NEXT_PUBLIC_APP_URL  = https://your-domain.com
- NODE_ENV             = production
```

### 9.3 ตั้งค่า Volumes (สำคัญ — ข้อมูลจะไม่หาย)

```
ใน Coolify UI → Storages:
Volume 1:
  - Name: postgres_data
  - Mount Path: /var/lib/postgresql/data
  - Service: postgres

Volume 2:
  - Name: redis_data
  - Mount Path: /data
  - Service: redis

Volume 3:
  - Name: uploads
  - Mount Path: /app/public/uploads
  - Service: app
```

### 9.4 Deploy ครั้งแรก

```
1. กด "Deploy" (ปุ่มสีน้ำเงิน)
2. ดู logs ใน Coolify UI — ควรเห็น:
   ✅ Pulling images...
   ✅ Starting postgres... healthy
   ✅ Starting redis... healthy
   ✅ Starting app...
   ✅ Starting nginx...
3. รอ ~2-5 นาที
```

---

## 10. ตั้งค่า Domain + SSL

### 10.1 ตั้งค่า DNS

```
ไปที่ผู้ให้บริการ DNS (เช่น Cloudflare, GoDaddy, Namecheap)

เพิ่ม DNS Record:
Type: A
Name: @ (หรือ subdomain เช่น app)
Value: YOUR_SERVER_IP
TTL: Auto

ตัวอย่าง:
- your-domain.com      → YOUR_SERVER_IP
- www.your-domain.com  → YOUR_SERVER_IP
```

### 10.2 ตั้งค่า Domain ใน Coolify

```
1. ไปที่ Service → Settings → Domains
2. เพิ่ม domain: https://your-domain.com
3. เปิด "Generate SSL Certificate" (Let's Encrypt)
4. กด "Save"
5. กด "Deploy" อีกครั้ง
```

### 10.3 แก้ไข nginx.conf สำหรับ HTTPS

```bash
# บน server หรือแก้ใน repo
# เพิ่ม redirect HTTP → HTTPS
```

ตรวจสอบ SSL:
```bash
# บน server
curl -I https://your-domain.com
# ควรได้ HTTP/2 200
```

---

## 11. Database Migration (ครั้งแรก)

### 11.1 รัน Migration

```bash
# SSH เข้า server
ssh root@YOUR_SERVER_IP

# หา container name ของ app
docker ps | grep edencolors

# รัน prisma migrate
docker exec -it CONTAINER_NAME_OF_APP npx prisma migrate deploy

# ตัวอย่าง output:
# Applying migration `20240101000000_init`
# Database schema was successfully updated!
```

### 11.2 Seed ข้อมูลเริ่มต้น (optional)

```bash
# Seed master data (units, warehouses, ฯลฯ)
docker exec -it CONTAINER_NAME_OF_APP npx tsx prisma/seed.ts
```

### 11.3 ตรวจสอบ Database

```bash
# เข้า PostgreSQL
docker exec -it CONTAINER_NAME_OF_POSTGRES psql -U edencolors -d edencolors

# ตรวจสอบ tables
\dt

# ควรเห็น tables เหล่านี้:
# users, product_masters, product_items, grn_headers, outbound_headers, ...

# ออก
\q
```

---

## 12. ทดสอบ & Verify

### 12.1 ทดสอบ Endpoints

```bash
# Health check
curl http://YOUR_SERVER_IP/api/health
# ควรได้: {"status":"ok"}

# ทดสอบ HTTPS
curl https://your-domain.com/api/health
# ควรได้: {"status":"ok"}
```

### 12.2 เช็ค Services ทั้งหมด

```bash
# ดู status ทุก container
docker ps

# ควรเห็น STATUS = "Up X minutes (healthy)" สำหรับ postgres และ redis
# app และ nginx ควรเป็น "Up X minutes"
```

### 12.3 ดู Logs

```bash
# App logs
docker logs CONTAINER_APP_NAME -f --tail 50

# Nginx logs
docker logs CONTAINER_NGINX_NAME -f --tail 50

# Postgres logs
docker logs CONTAINER_POSTGRES_NAME -f --tail 20
```

---

## 13. Update / Redeploy

### 13.1 วิธี Update Code (จากเครื่อง Dev)

```bash
# Step 1: แก้ code, commit, push ขึ้น GitHub
git add .
git commit -m "feat: your change description"
git push origin main

# Step 2: Build Docker image ใหม่
docker build --platform linux/amd64 -t YOUR_DOCKERHUB_USERNAME/edencolors:latest .

# Step 3: Push image ใหม่
docker push YOUR_DOCKERHUB_USERNAME/edencolors:latest

# Step 4: Coolify จะ auto-deploy (ถ้าตั้ง webhook)
# หรือกด Deploy ใน Coolify UI
```

### 13.2 ใช้ deploy.sh (ทำทุกอย่างในขั้นตอนเดียว)

```bash
# ตั้งค่า environment variable
export DEPLOY_SERVER=root@YOUR_SERVER_IP

# รัน deploy script
bash deploy.sh

# หรือระบุ tag
bash deploy.sh v1.2.0
```

### 13.3 ตั้งค่า Auto-deploy ใน Coolify

```
1. ไปที่ Service → Settings → Git Webhooks
2. เปิด "Auto Deploy on Push"
3. Branch: main
4. Coolify จะ deploy อัตโนมัติทุกครั้งที่ push ขึ้น GitHub
```

### 13.4 Deploy พร้อม DB Migration

```bash
# ถ้ามี schema changes ใหม่
ssh root@YOUR_SERVER_IP

# รัน migration หลัง deploy เสร็จ
docker exec -it CONTAINER_APP_NAME npx prisma migrate deploy
```

---

## 14. Troubleshooting

### ❌ App ไม่ start / Crash loop

```bash
# ดู error logs
docker logs CONTAINER_APP_NAME --tail 100

# ปัญหาที่พบบ่อย:
# 1. DATABASE_URL ผิด → ตรวจสอบ .env.production
# 2. Prisma client ไม่ generate → ตรวจสอบ Dockerfile
# 3. Port conflict → docker ps เพื่อดู ports
```

### ❌ Database connection failed

```bash
# ตรวจสอบว่า postgres healthy
docker ps | grep postgres

# ทดสอบ connection
docker exec -it CONTAINER_POSTGRES psql -U edencolors -d edencolors -c "SELECT 1;"

# ตรวจสอบ DATABASE_URL ใน .env.production
# ต้องใช้ชื่อ service ไม่ใช่ localhost:
# ✅ postgresql://edencolors:PASSWORD@postgres:5432/edencolors
# ❌ postgresql://edencolors:PASSWORD@localhost:5432/edencolors
```

### ❌ SSL Certificate ไม่ออก

```bash
# ตรวจสอบว่า domain ชี้มาที่ server แล้ว
nslookup your-domain.com
# ต้องได้ IP ของ server

# ตรวจสอบ port 80 เปิดอยู่
curl http://your-domain.com
# Let's Encrypt ต้องใช้ port 80 เพื่อ verify

# ตรวจสอบ firewall
ufw status
```

### ❌ Coolify UI ไม่เข้าได้

```bash
# ตรวจสอบ coolify container
docker ps | grep coolify

# Restart coolify
docker restart coolify

# ตรวจสอบ port 8000
ss -tlnp | grep 8000
```

### ❌ Upload รูปภาพไม่ได้

```bash
# ตรวจสอบ volume ของ uploads
docker exec -it CONTAINER_APP_NAME ls -la /app/public/uploads/

# ตรวจสอบ permissions
docker exec -it CONTAINER_APP_NAME chmod -R 755 /app/public/uploads/
```

### ❌ Migration fail

```bash
# ดู error
docker exec -it CONTAINER_APP_NAME npx prisma migrate status

# Reset migration (⚠️ ระวัง ข้อมูลจะหาย!)
# ใช้เฉพาะตอน dev เท่านั้น
docker exec -it CONTAINER_APP_NAME npx prisma migrate reset
```

---

## 📌 Quick Reference Commands

```bash
# ─── บน Server ───────────────────────────────────────────

# ดู services ทั้งหมด
docker ps

# ดู logs แบบ real-time
docker logs CONTAINER_NAME -f

# Restart service เดียว
docker restart CONTAINER_APP_NAME

# Stop ทุก service
docker compose -f /root/edencolors/docker-compose.prod.yml down

# Start ทุก service
docker compose -f /root/edencolors/docker-compose.prod.yml up -d

# รัน migration
docker exec -it CONTAINER_APP_NAME npx prisma migrate deploy

# เข้า DB shell
docker exec -it CONTAINER_POSTGRES psql -U edencolors -d edencolors

# ─── บนเครื่อง Dev ────────────────────────────────────────

# Build + Push image
make build-push

# Deploy to server
DEPLOY_SERVER=root@IP make deploy

# ดู logs บน server
make prod-logs
```

---

## 🔐 Security Checklist

```
✅ เปลี่ยน .env.production ค่า default ทั้งหมด
✅ ใช้ password แข็งแรง (อย่างน้อย 24 ตัวอักษร)
✅ เปิด HTTPS เท่านั้น (redirect HTTP → HTTPS)
✅ ปิด port ที่ไม่ใช้ (5432, 6379 ต้องไม่ expose)
✅ ตั้ง Coolify UI password แข็งแรง
✅ ไม่ commit .env ขึ้น GitHub
✅ Backup database สม่ำเสมอ
✅ ตั้ง Coolify auto-update notifications
```

---

## 💾 Backup Database

```bash
# Backup
docker exec CONTAINER_POSTGRES pg_dump -U edencolors edencolors > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore
docker exec -i CONTAINER_POSTGRES psql -U edencolors edencolors < backup_20260101_120000.sql
```

---

*Last updated: 2026-03-06*
*Project: EdenColors — QR Authenticity & Product Activation System*

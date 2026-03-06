# AI AGENT DEPLOYMENT GUIDE — EdenColors
## ไฟล์นี้สำหรับให้ AI อ่านและรัน commands ทั้งหมดอัตโนมัติ

> **วิธีใช้:** บอก AI ว่า "อ่านไฟล์นี้และทำตาม checklist ทีละขั้น"
> **หมายเหตุ:** AI จะถาม input จากผู้ใช้ก่อนรันในขั้นตอนที่ต้องกรอกข้อมูล

---

## CONTEXT

- **Project:** EdenColors — QR Authenticity & Activation System
- **Stack:** Next.js 16, PostgreSQL 16, Redis 7, Nginx, Docker, Coolify
- **Docker Image:** sunthornrk/edencolors:latest (Docker Hub)
- **Repo:** https://github.com/YOUR_USERNAME/edencolors
- **Deploy Tool:** Coolify (Self-hosted PaaS)
- **Files ที่สำคัญ:**
  - `docker-compose.prod.yml` — Production services
  - `.env.production.example` — Template สำหรับ env
  - `nginx.conf` — Nginx reverse proxy config
  - `Dockerfile` — Multi-stage build (standalone)
  - `prisma/schema.prisma` — Database schema

---

## PHASE 1: เตรียมเครื่อง Dev (Windows Notebook ใหม่)

### TASK 1.1 — ตรวจสอบ tools ที่จำเป็น
```
AI: รันคำสั่งต่อไปนี้และตรวจสอบ output
```
```cmd
git --version
node --version
npm --version
docker --version
docker compose version
```
**Expected:** git 2.x, node v22.x, npm 10.x, docker 27.x
**ถ้าไม่มี:** ให้ผู้ใช้ดาวน์โหลดและติดตั้งก่อน

### TASK 1.2 — Clone และติดตั้ง project
```cmd
git clone https://github.com/YOUR_USERNAME/edencolors.git
cd edencolors
npm install
copy .env.example .env
```

### TASK 1.3 — ทดสอบ dev environment
```cmd
npm run db:up
```
รอ 10 วินาที แล้ว:
```cmd
npm run db:migrate
npm run db:seed
npm run dev
```
**Verify:** เปิด http://localhost:3000 — ต้องเห็นหน้า login

---

## PHASE 2: เตรียม GitHub + Docker Hub

### TASK 2.1 — Push ขึ้น GitHub
**AI ถาม:** GitHub username คืออะไร? Repository ชื่ออะไร?
```cmd
git remote add origin https://github.com/{GITHUB_USERNAME}/{REPO_NAME}.git
git branch -M main
git push -u origin main
```

### TASK 2.2 — Build Docker Image
**AI ถาม:** Docker Hub username คืออะไร?
```cmd
docker login
docker build --platform linux/amd64 -t {DOCKERHUB_USERNAME}/edencolors:latest .
docker push {DOCKERHUB_USERNAME}/edencolors:latest
```
**Verify:** ไปดูที่ https://hub.docker.com/r/{DOCKERHUB_USERNAME}/edencolors

### TASK 2.3 — อัพเดท docker-compose.prod.yml ถ้า username ต่าง
ตรวจสอบ line นี้ใน docker-compose.prod.yml:
```yaml
image: sunthornrk/edencolors:latest
```
ถ้า Docker Hub username ต่าง → แก้ให้ตรง

---

## PHASE 3: Setup Server

### TASK 3.1 — SSH เข้า server
**AI ถาม:** Server IP คืออะไร? Username คืออะไร?
```bash
ssh {SERVER_USER}@{SERVER_IP}
```

### TASK 3.2 — รัน setup script
```bash
curl -fsSL https://raw.githubusercontent.com/{GITHUB_USERNAME}/edencolors/main/scripts/server-setup.sh | bash
```
หรือถ้า clone แล้ว:
```bash
bash /root/edencolors/scripts/server-setup.sh
```
**Verify:** ดู output — ต้องเห็น ✅ ทุกข้อ

### TASK 3.3 — ตรวจสอบ Coolify
```bash
docker ps | grep coolify
```
**Expected:** เห็น coolify, coolify-proxy, coolify-db ทำงานอยู่

---

## PHASE 4: Generate Environment Variables

### TASK 4.1 — รัน gen-env script บน server
```bash
cd /root/edencolors
git clone https://github.com/{GITHUB_USERNAME}/edencolors.git .  # ถ้ายังไม่ได้ clone
bash scripts/gen-env.sh
```
**AI ถาม user:** Domain, Cloudflare R2 credentials (ถ้าใช้)

### TASK 4.2 — ตรวจสอบไฟล์
```bash
cat .env.production
# ตรวจสอบว่าไม่มีค่า CHANGE_ME หลงเหลือ
grep "CHANGE_ME" .env.production && echo "❌ ยังมีค่าที่ต้องแก้" || echo "✅ OK"
```

---

---

## PHASE 5: Deploy ผ่าน Coolify UI

### TASK 5.1 — เปิด Coolify
```
URL: http://{SERVER_IP}:8000
```
ครั้งแรก: สร้าง Admin account → Register

### TASK 5.2 — เพิ่ม Server (Localhost)
```
Servers → + Add Server → Localhost → Save → Validate & Test
Expected: "Connected" ✅
```

### TASK 5.3 — สร้าง Project
```
Projects → + New Project
Name: edencolors
→ Create
```

### TASK 5.4 — เพิ่ม Docker Registry
```
Settings → Registries → + Add Registry
Type: Docker Hub
Username: {DOCKERHUB_USERNAME}
Password: {DOCKERHUB_ACCESS_TOKEN}
→ Save
```

### TASK 5.5 — เชื่อม GitHub
```
Settings → Sources → + Add Source
Type: GitHub App
→ Register GitHub App (ทำใน browser)
→ Install บน repo: edencolors
→ กลับมา Coolify → Refresh
Expected: GitHub connected ✅
```

### TASK 5.6 — สร้าง Service
```
Projects → edencolors → Production → + New Resource
Type: Docker Compose
Source: GitHub
Repository: edencolors
Branch: main
Docker Compose file: ./docker-compose.prod.yml
→ Save
```

### TASK 5.7 — ตั้ง Environment Variables ใน Coolify
```
Service → Environment Variables → Import .env
วางเนื้อหาจาก .env.production ที่ gen ไว้
→ Save
```

### TASK 5.8 — Deploy!
```
กด "Deploy" (ปุ่มสีน้ำเงิน)
ดู Logs → รอจน all services healthy
ใช้เวลา: ~3-5 นาที
```

**Verify:**
```bash
docker ps
# ต้องเห็น: app, postgres (healthy), redis (healthy), nginx
```

---

## PHASE 6: Database Migration

### TASK 6.1 — หา Container Name
```bash
docker ps --format "table {{.Names}}\t{{.Status}}" | grep edencolors
```

### TASK 6.2 — รัน Migration
```bash
# แทน CONTAINER_APP ด้วย container name จริง
docker exec -it {CONTAINER_APP} npx prisma migrate deploy
```
**Expected output:**
```
Applying migration `20240101000000_init`
Database schema was successfully updated!
```

### TASK 6.3 — Seed ข้อมูลเริ่มต้น (ครั้งแรกเท่านั้น)
```bash
docker exec -it {CONTAINER_APP} npx tsx prisma/seed.ts
```

### TASK 6.4 — ตรวจสอบ Tables
```bash
docker exec -it {CONTAINER_POSTGRES} psql -U edencolors -d edencolors -c "\dt"
```
**Expected:** เห็น tables: users, product_masters, product_items, grn_headers, outbound_headers, ...

---

## PHASE 7: Domain + SSL

### TASK 7.1 — ตั้ง DNS
```
ที่ DNS provider:
Type: A
Name: @ (หรือ subdomain)
Value: {SERVER_IP}
TTL: 300

รอ DNS propagate: 5-30 นาที
ทดสอบ: nslookup your-domain.com
```

### TASK 7.2 — เพิ่ม Domain ใน Coolify
```
Service → Settings → Domains
Add: https://your-domain.com
Enable: Generate SSL (Let's Encrypt)
→ Save → Deploy
```

### TASK 7.3 — ตรวจสอบ SSL
```bash
curl -I https://your-domain.com/api/health
# Expected: HTTP/2 200, {"status":"ok"}
```

---

## PHASE 8: Final Verification Checklist

```bash
# 1. Health check
curl https://your-domain.com/api/health

# 2. ตรวจสอบ services
docker ps

# 3. ตรวจสอบ logs ไม่มี error
docker logs {CONTAINER_APP} --tail 20

# 4. ทดสอบ login ผ่าน browser
# เปิด https://your-domain.com
# Login ด้วย admin account จาก seed
```

**Seed Admin Credentials (default):**
- ดูใน `prisma/seed.ts` บรรทัดที่สร้าง user แรก

---

## PHASE 9: ตั้งค่า Auto-Deploy

### TASK 9.1 — ตั้ง Webhook ใน Coolify
```
Service → Settings → Git Webhooks
Enable: Auto Deploy on Push to main
→ Save
```

### TASK 9.2 — ทดสอบ Auto-Deploy
```bash
# บนเครื่อง dev
echo "# test" >> README.md
git add README.md
git commit -m "test: auto-deploy"
git push origin main

# ดูใน Coolify → Deployments → ต้องเห็น deploy ใหม่เริ่มต้น
```

---

## VARIABLES REFERENCE

| Variable | Description | ตัวอย่าง |
|----------|-------------|---------|
| `{SERVER_IP}` | IP address ของ server | 192.168.1.100 |
| `{SERVER_USER}` | SSH username | root |
| `{GITHUB_USERNAME}` | GitHub username | sunthornrk |
| `{REPO_NAME}` | GitHub repo name | edencolors |
| `{DOCKERHUB_USERNAME}` | Docker Hub username | sunthornrk |
| `{DOCKERHUB_ACCESS_TOKEN}` | Docker Hub Access Token | dckr_pat_xxx |
| `{CONTAINER_APP}` | App container name | edencolors-app-1 |
| `{CONTAINER_POSTGRES}` | PostgreSQL container name | edencolors-postgres-1 |
| `{DOMAIN}` | Production domain | edencolors.example.com |

---

## ERROR RECOVERY

### ถ้า deploy fail → rollback
```bash
# Pull image เก่า
docker pull {DOCKERHUB_USERNAME}/edencolors:previous
# แก้ docker-compose.prod.yml ให้ใช้ tag เก่า
# docker compose up -d
```

### ถ้า DB ล่ม
```bash
docker restart {CONTAINER_POSTGRES}
docker logs {CONTAINER_POSTGRES} --tail 30
```

### ถ้า SSL ไม่ออก
```bash
# ตรวจสอบ DNS
nslookup {DOMAIN}
# ต้องได้ {SERVER_IP}

# ตรวจสอบ port 80
curl http://{DOMAIN}
```

---

*EdenColors Deployment Runbook v1.0*
*สร้างเพื่อให้ AI/Automation อ่านและ execute ได้โดยตรง*

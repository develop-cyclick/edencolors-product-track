# EdenColors — QR Authenticity & Product Activation System

ระบบจัดการสินค้า QR Code สำหรับตรวจสอบความแท้และติดตามการเคลื่อนไหวของสินค้า  
Built with **Next.js 16**, **PostgreSQL**, **Redis**, **Prisma**, **Docker**

---

## 🧱 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend + API | Next.js 16 (App Router, TypeScript) |
| Database | PostgreSQL 16 |
| Cache / Session | Redis 7 |
| ORM | Prisma |
| Reverse Proxy | Nginx |
| Container | Docker + Docker Compose |
| Auth | JWT + HTTP-only Cookie |
| i18n | Thai / English |

---

## 🚀 Development (Local)

### Prerequisites
- Node.js 22+
- Docker Desktop

### 1. Clone & Install
```bash
git clone https://github.com/YOUR_USERNAME/edencolors.git
cd edencolors
npm install
```

### 2. Setup Environment
```bash
cp .env.example .env
```

### 3. Start Database (Docker)
```bash
npm run db:up        # Start PostgreSQL + Redis
npm run db:migrate   # Run migrations
npm run db:seed      # Seed initial data
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

---

## 🐳 Production Deploy (Docker)

### Prerequisites (on server)
- Docker + Docker Compose

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### 1. Clone project on server
```bash
git clone https://github.com/YOUR_USERNAME/edencolors.git
cd edencolors
```

### 2. Setup production environment
```bash
cp .env.production.example .env.production
nano .env.production   # Fill in all secrets and domain
```

Generate secrets:
```bash
openssl rand -hex 32   # Use for JWT_SECRET, COOKIE_SECRET, QR_TOKEN_SECRET
```

### 3. Start all services
```bash
docker compose -f docker-compose.prod.yml up -d
```

### 4. Run database migration (first time only)
```bash
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
```

### 5. Access the app
```
http://YOUR_SERVER_IP
```

---

## 🔄 Update / Redeploy

```bash
# On dev machine: build and push new image
DEPLOY_SERVER=user@your-server-ip bash deploy.sh

# Or manually on server:
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

---

## 🗂️ Project Structure

```
├── app/                  # Next.js App Router (pages + API routes)
├── components/           # Reusable UI components
├── lib/                  # Utilities (auth, pdf, prisma, etc.)
├── prisma/               # Database schema + migrations + seed
├── public/               # Static assets + uploaded files
├── i18n/                 # Translations (th/en)
├── docker-compose.yml          # Dev: PostgreSQL + Redis
├── docker-compose.prod.yml     # Prod: App + DB + Redis + Nginx
├── Dockerfile            # Multi-stage production build
├── nginx.conf            # Reverse proxy config
└── deploy.sh             # Deploy script (build → push → server)
```

---

## 📦 Useful Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm run db:up` | Start DB containers |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed initial data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Reset database |

---

## 🔐 Environment Variables

See `.env.example` for development and `.env.production.example` for production.

> ⚠️ Never commit `.env` or `.env.production` to version control.

---

## 📄 License

Private — All rights reserved.

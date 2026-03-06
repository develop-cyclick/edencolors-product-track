#!/bin/bash
# =======================================================
# EdenColors — Generate .env.production
# รันบน server หลังจาก clone project แล้ว
# Usage: bash scripts/gen-env.sh
# =======================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

OUTPUT_FILE=".env.production"

echo ""
echo "=================================================="
echo "  EdenColors — Generate Production Environment"
echo "=================================================="
echo ""

# ตรวจสอบว่าไฟล์มีอยู่แล้ว
if [ -f "$OUTPUT_FILE" ]; then
  echo -e "${YELLOW}[!] ไฟล์ $OUTPUT_FILE มีอยู่แล้ว${NC}"
  read -p "ต้องการ overwrite? (y/N): " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || exit 0
fi

# ─── Collect inputs ────────────────────────────────
echo -e "${BLUE}[→]${NC} กรอกข้อมูลต่อไปนี้ (กด Enter เพื่อใช้ค่า default):"
echo ""

read -p "Domain (เช่น https://edencolors.example.com): " APP_URL
APP_URL=${APP_URL:-"https://your-domain.com"}

read -s -p "DB Password (Enter เพื่อ auto-generate): " DB_PASS
echo ""
if [ -z "$DB_PASS" ]; then
  DB_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
  echo -e "${GREEN}[✓]${NC} DB Password auto-generated"
fi

# ─── Generate Secrets ──────────────────────────────
echo -e "${BLUE}[→]${NC} Generating secrets..."
JWT_SECRET=$(openssl rand -hex 32)
COOKIE_SECRET=$(openssl rand -hex 32)
QR_TOKEN_SECRET=$(openssl rand -hex 32)

# ─── R2 Storage ────────────────────────────────────
echo ""
read -p "ใช้ Cloudflare R2 สำหรับเก็บรูปภาพ? (y/N): " USE_R2
if [[ "$USE_R2" =~ ^[Yy]$ ]]; then
  read -p "R2 Account ID: " R2_ACCOUNT_ID
  read -p "R2 Access Key ID: " R2_KEY_ID
  read -s -p "R2 Secret Key: " R2_SECRET
  echo ""
  read -p "R2 Bucket Name [edencolors-assets]: " R2_BUCKET
  R2_BUCKET=${R2_BUCKET:-"edencolors-assets"}
  read -p "R2 Public URL (เช่น https://pub-xxx.r2.dev): " R2_PUBLIC
fi

# ─── Write .env.production ─────────────────────────
cat > "$OUTPUT_FILE" << EOF
# =================================
# EdenColors Production Environment
# Generated: $(date)
# =================================

# Database
DB_PASSWORD=${DB_PASS}
DATABASE_URL=postgresql://edencolors:${DB_PASS}@postgres:5432/edencolors?schema=public

# Redis
REDIS_URL=redis://redis:6379

# Auth Secrets
JWT_SECRET=${JWT_SECRET}
COOKIE_SECRET=${COOKIE_SECRET}
QR_TOKEN_SECRET=${QR_TOKEN_SECRET}

# App
NEXT_PUBLIC_APP_URL=${APP_URL}
NODE_ENV=production
EOF

# เพิ่ม R2 ถ้าเลือกใช้
if [[ "$USE_R2" =~ ^[Yy]$ ]]; then
cat >> "$OUTPUT_FILE" << EOF

# Cloudflare R2 Storage
R2_ACCESS_KEY_ID=${R2_KEY_ID}
R2_SECRET_ACCESS_KEY=${R2_SECRET}
R2_ENDPOINT=https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
R2_BUCKET_NAME=${R2_BUCKET}
R2_PUBLIC_URL=${R2_PUBLIC}
EOF
fi

# ─── Set file permissions ──────────────────────────
chmod 600 "$OUTPUT_FILE"

# ─── Summary ───────────────────────────────────────
echo ""
echo "=================================================="
echo -e "${GREEN}✅ สร้างไฟล์ $OUTPUT_FILE เสร็จแล้ว!${NC}"
echo "=================================================="
echo ""
echo "สรุปค่าที่ generate:"
echo "  DB_PASSWORD:      (hidden)"
echo "  JWT_SECRET:       ${JWT_SECRET:0:16}..."
echo "  COOKIE_SECRET:    ${COOKIE_SECRET:0:16}..."
echo "  QR_TOKEN_SECRET:  ${QR_TOKEN_SECRET:0:16}..."
echo "  APP_URL:          $APP_URL"
echo ""
echo -e "${YELLOW}[!] ⚠️  BACKUP ไฟล์นี้ไว้ด้วย — ถ้าหายต้อง migrate DB ใหม่!${NC}"
echo ""
echo "ขั้นตอนถัดไป:"
echo "  docker compose -f docker-compose.prod.yml --env-file .env.production up -d"
echo ""

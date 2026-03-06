#!/bin/bash
# =======================================================
# EdenColors — Server Setup Script
# รันบน Ubuntu 22.04/24.04 LTS (ใหม่ล้วน)
# Usage: bash server-setup.sh
# =======================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
info() { echo -e "${BLUE}[→]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo ""
echo "=================================================="
echo "  EdenColors Server Setup"
echo "=================================================="
echo ""

# ─── 1. ตรวจสอบ OS ─────────────────────────────────
info "ตรวจสอบ OS..."
if ! grep -q "Ubuntu" /etc/os-release; then
  warn "Script นี้ test กับ Ubuntu เท่านั้น — ดำเนินการต่อ?"
  read -p "Continue? (y/N): " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || exit 1
fi
log "OS OK"

# ─── 2. Update System ───────────────────────────────
info "Update system packages..."
apt update -qq && apt upgrade -y -qq
log "System updated"

# ─── 3. ตั้ง Timezone ──────────────────────────────
info "ตั้ง timezone เป็น Asia/Bangkok..."
timedatectl set-timezone Asia/Bangkok
log "Timezone: $(date)"

# ─── 4. ติดตั้ง UFW Firewall ───────────────────────
info "ตั้งค่า Firewall..."
apt install -y ufw -qq
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment 'SSH'
ufw allow 80/tcp   comment 'HTTP'
ufw allow 443/tcp  comment 'HTTPS'
ufw allow 8000/tcp comment 'Coolify UI'
ufw --force enable
log "Firewall configured"
ufw status

# ─── 5. ติดตั้ง Docker ─────────────────────────────
info "ติดตั้ง Docker..."
if command -v docker &> /dev/null; then
  warn "Docker มีอยู่แล้ว: $(docker --version)"
else
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker $USER
  log "Docker installed: $(docker --version)"
fi

# ─── 6. ติดตั้ง Coolify ────────────────────────────
info "ติดตั้ง Coolify..."
if docker ps | grep -q "coolify"; then
  warn "Coolify ทำงานอยู่แล้ว — ข้ามการติดตั้ง"
else
  curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
  log "Coolify installed"
fi

# ─── 7. สร้าง project folder ────────────────────────
info "สร้าง /root/edencolors..."
mkdir -p /root/edencolors
log "Folder created"

# ─── 8. สรุป ────────────────────────────────────────
echo ""
echo "=================================================="
echo -e "${GREEN}✅ Setup เสร็จสมบูรณ์!${NC}"
echo "=================================================="
echo ""
echo "ขั้นตอนถัดไป:"
echo "  1. เปิด browser ไปที่: http://$(curl -s ifconfig.me):8000"
echo "  2. สร้าง Coolify Admin Account"
echo "  3. ทำตาม COOLIFY_DEPLOY_GUIDE.md ข้อ 7 เป็นต้นไป"
echo ""
echo "Server IP: $(curl -s ifconfig.me)"
echo ""

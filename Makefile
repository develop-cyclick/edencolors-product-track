# EdenColors — Makefile
# Usage: make <command>

IMAGE=sunthornrk/edencolors
TAG?=latest

# ─── Development ────────────────────────────────────────────
dev:
	npm run dev

db-up:
	docker compose up -d

db-down:
	docker compose down

db-migrate:
	npx prisma migrate dev

db-seed:
	npx tsx prisma/seed.ts

db-reset:
	npx prisma migrate reset

db-studio:
	npx prisma studio

# ─── Production Build ────────────────────────────────────────
build:
	docker build --platform linux/amd64 -t $(IMAGE):$(TAG) .

push:
	docker push $(IMAGE):$(TAG)

build-push: build push

# ─── Deploy ──────────────────────────────────────────────────
deploy:
	@if [ -z "$(DEPLOY_SERVER)" ]; then \
		echo "❌ Error: DEPLOY_SERVER is not set"; \
		echo "Usage: DEPLOY_SERVER=user@ip make deploy"; \
		exit 1; \
	fi
	bash deploy.sh $(TAG)

# ─── Server (run on remote server) ───────────────────────────
prod-up:
	docker compose -f docker-compose.prod.yml up -d

prod-down:
	docker compose -f docker-compose.prod.yml down

prod-logs:
	docker compose -f docker-compose.prod.yml logs -f

prod-migrate:
	docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy

prod-restart:
	docker compose -f docker-compose.prod.yml restart app

# ─── Help ─────────────────────────────────────────────────────
help:
	@echo ""
	@echo "EdenColors — Available Commands"
	@echo "================================"
	@echo "  Development:"
	@echo "    make dev          Start dev server"
	@echo "    make db-up        Start local DB (Docker)"
	@echo "    make db-migrate   Run Prisma migrations"
	@echo "    make db-seed      Seed initial data"
	@echo "    make db-studio    Open Prisma Studio"
	@echo ""
	@echo "  Build & Deploy:"
	@echo "    make build        Build Docker image"
	@echo "    make push         Push image to Docker Hub"
	@echo "    make build-push   Build + Push in one step"
	@echo "    DEPLOY_SERVER=user@ip make deploy"
	@echo ""
	@echo "  Server:"
	@echo "    make prod-up      Start all services"
	@echo "    make prod-down    Stop all services"
	@echo "    make prod-logs    View logs"
	@echo "    make prod-migrate Run DB migrations"
	@echo "    make prod-restart Restart app only"
	@echo ""

.PHONY: dev db-up db-down db-migrate db-seed db-reset db-studio \
        build push build-push deploy \
        prod-up prod-down prod-logs prod-migrate prod-restart help

# --- Stage 1: Dependencies ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Stage 2: Build ---
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# --- Stage 2b: Prisma toolchain ---
# `prisma migrate deploy` / `tsx prisma/seed.ts` run at deploy time inside the app
# container, but Next.js standalone tracing only bundles app-runtime deps — not the
# Prisma CLI's own dependency tree (e.g. @prisma/config -> effect, c12, ...).
# Installing the CLI toolchain in an isolated project captures its complete
# transitive closure so we don't have to cherry-pick (and keep missing) packages.
FROM node:22-alpine AS prisma-tools
WORKDIR /tools
RUN npm init -y >/dev/null 2>&1 \
 && npm install --no-audit --no-fund \
      prisma@6.19.2 tsx@4.21.0 bcryptjs@3.0.3

# --- Stage 3: Production ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Prisma CLI toolchain (full dependency closure) — base layer of node_modules.
# Copied first so the app's traced modules (below) win on any version overlap.
COPY --from=prisma-tools /tools/node_modules ./node_modules

# Copy built app (Next.js standalone output). Its node_modules merges over the
# toolchain, so app-runtime deps use their exact traced versions.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Generated Prisma client + engines (app's exact versions) + schema, on top
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# Recreate the .bin symlinks instead of COPYing them: Docker COPY dereferences a
# symlink into a real file, which makes prisma's __dirname resolve to .bin/ so it
# can't find its *.wasm (e.g. prisma_schema_build_bg.wasm). A symlink keeps
# __dirname pointing at prisma/build/ where the schema-engine wasm lives.
RUN mkdir -p node_modules/.bin \
 && ln -sf ../prisma/build/index.js node_modules/.bin/prisma \
 && ln -sf ../tsx/dist/cli.mjs node_modules/.bin/tsx

USER nextjs
EXPOSE 3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]

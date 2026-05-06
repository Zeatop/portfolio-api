# ── Stage 1 : Build ────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy source and compile TypeScript
COPY src ./src
RUN npm run build

# ── Stage 2 : Production ──────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JS from build stage
COPY --from=build /app/dist ./dist

# Run as non-root user (good practice)
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs
USER nodejs

EXPOSE 3001

# Healthcheck — Kubernetes va aussi en faire via les probes,
# mais ça aide en cas de docker run direct
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3001/api/health || exit 1

CMD ["node", "dist/index.js"]
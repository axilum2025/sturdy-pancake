# ============================================
# GiLo AI — Backend Dockerfile
# Multi-stage build for production
# ============================================

# --- Build stage ---
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# --- Production stage ---
FROM node:20-alpine
WORKDIR /app

# Install only production deps
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JS
COPY --from=builder /app/dist ./dist

# Create data directory for runtime storage (MCP configs etc.)
RUN mkdir -p ./data/projects && echo '[]' > ./data/mcp-servers.json

EXPOSE 3001

ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]

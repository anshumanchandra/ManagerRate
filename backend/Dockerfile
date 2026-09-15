# ==========================================
# ManagerRate Backend — Dockerfile
# ==========================================
# Multi-stage build for minimal production image.
#
# Build:  docker build -t managerrate-backend .
# Run:    docker run -p 3001:3001 --env-file .env managerrate-backend

# ============ STAGE 1: Install + Build ============
FROM node:18-alpine AS builder

WORKDIR /app

# Install OS deps for Prisma
RUN apk add --no-cache openssl

# Copy dependency manifests first (cache layer)
COPY package.json package-lock.json* ./
COPY prisma/ ./prisma/

# Install ALL dependencies (dev included, for prisma generate)
RUN npm ci --ignore-scripts && \
    npx prisma generate

# Copy source
COPY src/ ./src/

# ============ STAGE 2: Production Image ============
FROM node:18-alpine AS production

WORKDIR /app

# Install OS deps for Prisma runtime
RUN apk add --no-cache openssl wget

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser  -S appuser -u 1001 -G appgroup

# Copy production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts

# Copy generated Prisma client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy Prisma schema (needed for migrations)
COPY prisma/ ./prisma/

# Copy application source
COPY src/ ./src/

# Set ownership to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start server
CMD ["node", "src/server.js"]

# ==========================================
# ManagerRate Frontend — Dockerfile
# ==========================================
# Multi-stage build: Vite builds the React app,
# then Nginx serves it with /api proxied to backend.
#
# Build:  docker build -t managerrate-frontend .
# Run:    docker run -p 80:80 managerrate-frontend

# ============ STAGE 1: Build React App ============
FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependency manifests first (cache layer)
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build for production
RUN npm run build

# ============ STAGE 2: Serve with Nginx ============
FROM nginx:1.25-alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Create non-root user
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

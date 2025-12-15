FROM node:20-bookworm-slim AS base

# Create app directory
WORKDIR /app

# ---- Build Stage ----
FROM base AS builder

# Install dependencies (including devDependencies for build tools)
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build the application (clean dist folder first, then compile TypeScript)
RUN rm -rf dist && yarn tsc -p .

# ---- Production Stage ----
FROM base AS production

# Set environment variables
ENV PORT=3232

# Security: update base packages and install curl for healthcheck
RUN apt-get update \
    && apt-get -y upgrade \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install production dependencies only
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/yarn.lock ./

# Create and use non-root user for security (Debian)
RUN groupadd -g 1001 nodejs \
    && useradd -u 1001 -g nodejs -s /usr/sbin/nologin -m nodejs \
    && mkdir -p logs \
    && chown -R nodejs:nodejs /app
USER nodejs

# Expose the application port
EXPOSE 3232

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -fsS http://localhost:${PORT}/health || exit 1

# Default command runs the API; compose overrides run workers
CMD ["node", "dist/app.js"]

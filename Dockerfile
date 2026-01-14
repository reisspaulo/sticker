# Build stage
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-slim

# Build arguments for versioning
ARG GIT_COMMIT_SHA=unknown
ARG DEPLOYED_AT=unknown

# Set as environment variables
ENV GIT_COMMIT_SHA=$GIT_COMMIT_SHA
ENV DEPLOYED_AT=$DEPLOYED_AT

# Install ffmpeg for GIF processing and Python for rembg
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install rembg with CPU backend and CLI
RUN pip3 install --no-cache-dir --break-system-packages "rembg[cpu,cli]"

# Pre-download AI models during build (as root, before USER switch)
RUN mkdir -p /tmp/rembg-test && \
    echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" | base64 -d > /tmp/rembg-test/test.png && \
    rembg i /tmp/rembg-test/test.png /tmp/rembg-test/output.png || true && \
    rm -rf /tmp/rembg-test

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --production

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create non-root user (Debian syntax)
RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs nodejs && \
    mkdir -p /home/nodejs/.u2net && \
    chown -R nodejs:nodejs /home/nodejs

USER nodejs

EXPOSE 3000

# Default command (can be overridden in docker-compose)
CMD ["node", "dist/server.js"]

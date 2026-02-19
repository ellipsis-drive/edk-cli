# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Production stage
FROM node:20-alpine AS production

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1623 -S nodejs && \
    adduser -S nodejs -u 1623

# RUN apk add --no-cache curl bash ca-certificates
# RUN curl -LO https://dl.k8s.io/release/v1.35.0/bin/linux/amd64/kubectl && \
#     chmod +x kubectl && \
#     mv kubectl /usr/local/bin/

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app /app

# Switch to non-root user
USER nodejs

# Start the application
CMD ["node", "src/vectorCluster/vectorCluster.js", "master"]
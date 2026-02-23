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
RUN addgroup -g 1623 -S ellipsis && \
    adduser -S ellipsis -u 1623

# Copy built application from builder stage
COPY --from=builder --chown=ellipsis:ellipsis /app /app

# Switch to non-root user
USER ellipsis

# Start the application
CMD ["node", "run.js", "userDeletionManagement"]
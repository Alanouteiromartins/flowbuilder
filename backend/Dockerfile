# Base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (only production)
RUN npm ci --omit=dev

# Copy backend source files
COPY src/ ./src/

# Expose port (default Node port)
EXPOSE 3000

# Start server
CMD ["node", "src/index.js"]

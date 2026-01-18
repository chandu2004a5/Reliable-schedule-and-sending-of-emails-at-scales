# Frontend Dockerfile
FROM node:20-alpine

# Install OpenSSL and libc6-compat
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy package files first (to cache layers)
COPY package.json package-lock.json* ./
RUN npm install

# Copy the rest of the code
COPY . .

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

CMD ["npm", "start"]

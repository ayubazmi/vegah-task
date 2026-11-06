# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Agar worker me build step hai toh (jaise tsc), warna skip kar sakta hai
RUN npm run build 

# Stage 2: Run
FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

# Worker ke liye healthcheck direct nahi hota, hum isko process check se dekh sakte hain
CMD ["node", "dist/worker.js"]

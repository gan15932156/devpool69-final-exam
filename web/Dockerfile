# ---------- deps: ติดตั้ง package ตาม package-lock.json ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# rewrites ใน next.config.ts ถูกอ่านตอน build → ต้องรู้ที่อยู่ Go ตั้งแต่ตอนนี้ (ใน Docker = ชื่อ service "api")
ARG API_URL=http://api:8080
ENV API_URL=$API_URL NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- run: ใช้ output "standalone" มีแค่ไฟล์ที่ต้องใช้จริง ----------
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]

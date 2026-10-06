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
# ตอนรันใช้แค่ node → ลบ npm / npx / corepack / yarn ที่มากับ image ออก
# ช่องโหว่ที่ scanner เจอใน image node อยู่ใน package ของ npm แทบทั้งหมด (ตรวจด้วย Trivy)
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
    /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-*
# รันเป็น user "node" ที่มากับ image ไม่ใช่ root · ไฟล์ต้องเป็นของ node เพราะ Next เขียน cache ลง .next
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
# ไม่ได้ตั้ง AUTH_SECRET → สุ่มใหม่ตอน container เริ่ม (ไม่มีค่า default ที่ใครก็รู้) · ผลคือสร้าง container ใหม่แล้วต้อง login ใหม่
CMD ["sh", "-c", "export AUTH_SECRET=\"${AUTH_SECRET:-$(head -c 32 /dev/urandom | base64)}\"; exec node server.js"]

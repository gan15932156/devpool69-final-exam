// npm run dev:mock — เปิดหน้าเว็บด้วย mock API ในตัว (web/mock) ไม่ต้องเปิด Go / PostgreSQL
// ทำงานโดยชี้ API_URL มาที่ route /mock ของ Next เอง → rewrites และ NextAuth ใช้ได้โดยไม่ต้องแก้โค้ด
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const port = process.env.PORT ?? "3000";
const env = {
  ...process.env,
  MOCK_API: "1",
  API_URL: `http://localhost:${port}/mock`,
  AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST ?? "true",
};
// ยังไม่ได้สร้าง .env.local → ใส่ AUTH_SECRET สำหรับ dev ให้ (มี .env.local แล้วใช้ค่าในไฟล์นั้น)
if (!process.env.AUTH_SECRET && !existsSync(".env.local")) env.AUTH_SECRET = "mock-dev-secret-not-for-production";

const child = spawn("npx", ["next", "dev", "-p", port], { stdio: "inherit", env, shell: process.platform === "win32" });
child.on("exit", (code) => process.exit(code ?? 0));

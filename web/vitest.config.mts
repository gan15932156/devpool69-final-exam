import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// npm test — test ฝั่งเว็บ (ไม่ต้องเปิด Go / Next)
// ค่าเริ่มต้นรันใน Node · ไฟล์ component (*.test.tsx) รันใน jsdom (DOM จำลอง)
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) }, // ตรงกับ paths "@/*" ใน tsconfig.json
  },
  test: {
    environment: "node",
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
    setupFiles: ["./test/setup.ts"],
    // ใบจอง/วันที่ฝั่งเว็บใช้เวลาเครื่อง (ถือว่าผู้ใช้อยู่เวลาไทย) → ล็อกเขตเวลาให้ผลเหมือนกันทุกเครื่อง
    env: { TZ: "Asia/Bangkok" },
    // npm run test:coverage → นับทุกไฟล์โค้ด รวมไฟล์ที่ยังไม่มี test (ได้ 0%) · รายงานอยู่ที่ coverage/index.html
    coverage: {
      provider: "v8",
      include: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "mock/**/*.ts", "auth.ts"],
      exclude: ["**/*.test.{ts,tsx}"],
      reporter: ["text", "html"],
    },
  },
});

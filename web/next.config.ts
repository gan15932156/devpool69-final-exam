import type { NextConfig } from "next";

// ที่อยู่ของ Go API — dev ใช้ localhost, ใน Docker จะส่งมาเป็น build arg
const API_URL = process.env.API_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  // standalone = build แล้วได้โฟลเดอร์ที่รันได้เลยพร้อม node_modules เท่าที่ใช้ → Docker image เล็ก
  output: "standalone",
  async rewrites() {
    return [
      // /api/v1/* ไม่ใช้ rewrite แล้ว → ผ่าน app/api/v1/[...path]/route.ts ที่แนบ token ให้ฝั่ง server
      // รูปเป็นไฟล์สาธารณะ ไม่ต้องใช้ token → ส่งต่อตรง ๆ
      { source: "/uploads/:path*", destination: `${API_URL}/uploads/:path*` },
    ];
  },
};

export default nextConfig;

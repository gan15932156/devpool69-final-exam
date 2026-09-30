import { readFile } from "node:fs/promises";
import path from "node:path";
import { isMockEnabled, store } from "@/mock/api";

// รูปของ mock: seed-*.jpg อ่านจาก api/internal/seed/images (รูปชุดเดียวกับ Go) · mock-* = รูปที่อัปโหลดระหว่างทดสอบ
// ไม่เจอไฟล์ (เช่น clone มาแค่โฟลเดอร์ web) → ส่งรูปสีพื้นแทน หน้าเว็บจะได้ไม่มีรูปแตก
const SEED_IMAGES = path.join(process.cwd(), "..", "api", "internal", "seed", "images");

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  if (!isMockEnabled()) return new Response("Not Found", { status: 404 });
  const { name } = await params;

  const uploaded = store().uploads.get(name);
  if (uploaded) return new Response(uploaded.data, { headers: { "Content-Type": uploaded.type } });

  const seed = /^seed-([a-z0-9-]+\.jpg)$/.exec(name);
  if (seed) {
    try {
      const data = await readFile(path.join(SEED_IMAGES, seed[1]));
      return new Response(data, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600" } });
    } catch {
      return new Response(placeholder(name), { headers: { "Content-Type": "image/svg+xml" } });
    }
  }
  return new Response("Not Found", { status: 404 });
}

function placeholder(name: string) {
  const hue = [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 0);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="hsl(${hue} 35% 70%)"/></svg>`;
}

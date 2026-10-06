import { redirect } from "next/navigation";
import { auth } from "@/auth";

// ใช้บนหน้าที่ต้อง login: const session = await requireSession("/bookings")
export async function requireSession(currentPath: string) {
  const session = await auth();
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(currentPath)}`);
  return session;
}

// กัน open redirect: รับเฉพาะ path ในเว็บเรา
// ให้ URL parser (ตัวเดียวกับที่เบราว์เซอร์ใช้) ตัดสิน เพราะเช็กแค่ตัวอักษรไม่พอ:
// "/\evil.com" และ "/<tab>/evil.com" ผ่านการเช็ก "//" แต่เบราว์เซอร์อ่านเป็น "//evil.com" = เว็บอื่น
const LOCAL = "http://local.invalid";
export function safeCallbackUrl(value: string | string[] | undefined) {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  const url = new URL(value, LOCAL);
  return url.origin === LOCAL ? url.pathname + url.search + url.hash : "/";
}

import { CalendarDays, Search, Store } from "lucide-react";

// เมนูหลัก 3 เมนู ใช้ทั้ง header (desktop) และ tab bar (มือถือ)
export const NAV_LINKS = [
  { href: "/", label: "ค้นหาร้าน", icon: Search },
  { href: "/bookings", label: "การจองของฉัน", icon: CalendarDays },
  { href: "/owner", label: "ร้านของฉัน", icon: Store },
] as const;

// เมนูไหนควรขีดเส้นใต้ · หน้าร้าน /restaurants/:id เปิดมาจากหน้าค้นหา จึงนับเป็นเมนู "ค้นหาร้าน"
export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/restaurants");
  return pathname.startsWith(href);
}

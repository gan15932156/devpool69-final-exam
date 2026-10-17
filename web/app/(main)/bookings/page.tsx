import { requireSession } from "@/lib/require-session";
import { MyBookingsView } from "./MyBookingsView";

// server component เช็ก login ก่อน → ยังไม่ login ถูกพาไป /login ทันที ไม่เห็นหน้าว่างแล้วค่อยเด้ง
export default async function BookingsPage() {
  await requireSession("/bookings");
  return <MyBookingsView />;
}

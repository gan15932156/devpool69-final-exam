import { requireSession } from "@/lib/require-session";
import { MyBookingsView } from "./MyBookingsView";

export default async function BookingsPage() {
  await requireSession("/bookings");
  return <MyBookingsView />;
}

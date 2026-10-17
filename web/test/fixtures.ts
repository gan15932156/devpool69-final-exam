import type { Availability } from "@/lib/booking";
import type { Booking, RestaurantDetail } from "@/lib/types";

// ข้อมูลตัวอย่างรูปร่างเดียวกับที่ Go ส่งมา · แก้เฉพาะช่องที่ test สนใจผ่าน overrides

export function restaurant(overrides: Partial<RestaurantDetail> = {}): RestaurantDetail {
  return {
    id: 1,
    ownerId: 9,
    name: "ครัวริมคลอง",
    cuisine: "อาหารไทย",
    description: "",
    seats: 10,
    openTime: "11:00",
    closeTime: "22:00",
    crossesMidnight: false,
    cancelLeadMinutes: 60,
    images: ["/uploads/a.jpg"],
    avgRating: null,
    reviewCount: 0,
    hasEnoughReviews: false,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    ...overrides,
  };
}

export function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 7,
    restaurantId: 1,
    restaurantName: "ครัวริมคลอง",
    partySize: 4,
    serviceDate: "2026-09-26",
    start: "18:00",
    end: "19:00",
    status: "confirmed",
    cancelDeadline: "17:00",
    cancelDeadlineDate: "2026-09-26",
    cancelLeadMinutes: 60,
    canCancel: true,
    hasReviewed: false,
    ...overrides,
  };
}

// availability ที่ใส่จำนวนคนเฉพาะบางช่อง: slots(22, { 2: 3 }) = 22 ช่อง ช่องที่ 2 มี 3 คน
export function availability(count: number, used: Record<number, number> = {}, seats = 10, date = "2026-09-26"): Availability {
  return { date, seats, slots: Array.from({ length: count }, (_, i) => ({ start: String(i), used: used[i] ?? 0, past: false })) };
}

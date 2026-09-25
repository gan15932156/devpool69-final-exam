// รูปร่างข้อมูลที่ Go ส่งมา (ตรงกับ struct ...DTO ใน api/internal/handlers)

export type Restaurant = {
  id: number;
  ownerId: number;
  name: string;
  cuisine: string;
  description: string;
  seats: number;
  openTime: string; // "18:00"
  closeTime: string; // "02:00"
  crossesMidnight: boolean;
  cancelLeadMinutes: number;
  images: string[];
  avgRating: number | null;
  reviewCount: number;
  hasEnoughReviews: boolean;
};

export type RestaurantDetail = Restaurant & {
  distribution: Record<string, number>; // { "5": 104, "4": 18, ... }
};

export type Booking = {
  id: number;
  restaurantId: number;
  restaurantName: string;
  partySize: number;
  serviceDate: string; // "2026-09-25" รอบของวันไหน
  start: string; // "18:00"
  end: string; // "01:30"
  status: "confirmed" | "cancelled";
  cancelDeadline: string; // "17:30"
  cancelDeadlineDate: string; // "2026-09-25"
  cancelLeadMinutes: number;
  canCancel: boolean;
  hasReviewed: boolean;
};

export type MyBookings = { upcoming: Booking[]; past: Booking[]; cancelled: Booking[] };

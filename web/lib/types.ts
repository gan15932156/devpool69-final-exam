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
  crossesMidnight: boolean; // ปิดหลังเที่ยงคืน (closeTime ≤ openTime) · Go คิดให้ หน้าเว็บไม่ต้องเทียบเอง
  cancelLeadMinutes: number; // ต้องแก้ไข/ยกเลิกก่อนเวลาเริ่มกี่นาที
  images: string[]; // "/uploads/xxx.jpg" · ตัวแรก = รูปหลัก
  avgRating: number | null; // ปัด 1 ตำแหน่งแล้วจาก SQL · null = ยังไม่มีรีวิว (ต่างจาก 0)
  reviewCount: number;
  hasEnoughReviews: boolean; // รีวิว ≥ 5 (MinReviewsForRanking ใน Go) · ไม่ถึง → ป้าย "รีวิวยังน้อย" และเรียงไว้ท้าย
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
  canCancel: boolean; // ยังแก้ไข/ยกเลิกได้ไหม · Go คิดจาก CanModify ตัวเดียวกับที่ตัดสินจริง → ปุ่มกับ API ไม่ขัดกัน
  hasReviewed: boolean; // เคยรีวิวร้านนี้แล้ว → แท็บ "ที่ผ่านมา" โชว์ "รีวิวแล้ว" แทนปุ่มเขียนรีวิว
};

// Go แบ่งแท็บให้แล้วด้วยเวลาของ server (ดูจากเวลาจบ + status) → นาฬิกาเครื่องผู้ใช้เพี้ยนก็ไม่ทำให้การ์ดอยู่ผิดแท็บ
export type MyBookings = { upcoming: Booking[]; past: Booking[]; cancelled: Booking[] };

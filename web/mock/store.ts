// ข้อมูลของ mock API เก็บในหน่วยความจำ (หายเมื่อปิด dev server) · รูปร่างเดียวกับตารางใน api/internal/models

export type User = { id: number; name: string; email: string; password: string; createdAt: number };

export type Restaurant = {
  id: number;
  ownerId: number;
  name: string;
  cuisine: string;
  description: string;
  seats: number;
  open: number; // นาทีนับจากเที่ยงคืน
  close: number; // close <= open = ปิดข้ามเที่ยงคืน
  lead: number; // ยกเลิกล่วงหน้ากี่นาที
  images: string[];
};

export type Booking = {
  id: number;
  restaurantId: number;
  userId: number;
  partySize: number;
  serviceDate: string; // "รอบ" ของวันไหน
  startAt: number; // ms
  endAt: number;
  status: "confirmed" | "cancelled";
};

export type Review = {
  id: number;
  restaurantId: number;
  userId: number;
  rating: number;
  comment: string;
  createdAt: number;
  updatedAt: number;
};

export type Store = {
  users: User[];
  restaurants: Restaurant[];
  bookings: Booking[];
  reviews: Review[];
  uploads: Map<string, { type: string; data: ArrayBuffer }>; // รูปที่อัปโหลดระหว่างทดสอบ
  lastId: { user: number; restaurant: number; booking: number; review: number };
};

export function emptyStore(): Store {
  return {
    users: [],
    restaurants: [],
    bookings: [],
    reviews: [],
    uploads: new Map(),
    lastId: { user: 0, restaurant: 0, booking: 0, review: 0 },
  };
}

export const nextId = (s: Store, table: keyof Store["lastId"]) => ++s.lastId[table];

// ---------- error หน้าตาเดียวกับ Go: { "error": { code, message, details } } ----------

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: unknown = null,
  ) {
    super(message);
  }

  withDetails(details: unknown) {
    return new AppError(this.status, this.code, this.message, details);
  }
}

export const validation = (fields: Record<string, string>) => new AppError(400, "VALIDATION", "ข้อมูลไม่ถูกต้อง", fields);
export const badBody = () => new AppError(400, "VALIDATION", "รูปแบบข้อมูลไม่ถูกต้อง");
export const unauthorized = () => new AppError(401, "UNAUTHORIZED", "กรุณาเข้าสู่ระบบ");
export const forbidden = () => new AppError(403, "FORBIDDEN", "คุณไม่มีสิทธิ์ทำรายการนี้");
export const notFound = (what: string) => new AppError(404, "NOT_FOUND", "ไม่พบ" + what);

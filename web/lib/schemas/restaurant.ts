import { z } from "zod";

// เพดานเดียวกับ api/internal/handlers/limits.go
export const MAX_SEATS = 1000;
export const MAX_CANCEL_LEAD_MINUTES = 7 * 24 * 60; // 7 วัน

// กติกาเดียวกับ restaurantInput.validate() ใน api/internal/handlers/restaurants.go
export const restaurantSchema = z
  .object({
    name: z.string().trim().min(1, "กรุณากรอกชื่อร้าน").max(100, "ชื่อร้านยาวเกินไป"),
    cuisine: z.string().trim().max(100, "ประเภทอาหารยาวเกินไป"),
    description: z.string().trim().max(2000, "รายละเอียดยาวเกินไป (ไม่เกิน 2,000 ตัวอักษร)"),
    seats: z
      .number({ error: "กรุณาใส่จำนวนที่นั่ง" })
      .int("ต้องเป็นจำนวนเต็ม")
      .min(1, "ต้องมีอย่างน้อย 1 ที่นั่ง")
      .max(MAX_SEATS, `ไม่เกิน ${MAX_SEATS.toLocaleString("en-US")} ที่นั่ง`),
    openTime: z.string(),
    closeTime: z.string(),
    cancelLeadMinutes: z
      .number()
      .int()
      .min(30, "ยกเลิกล่วงหน้าอย่างน้อย 30 นาที")
      .max(MAX_CANCEL_LEAD_MINUTES, "ยกเลิกล่วงหน้าได้นานสุด 7 วัน"),
    images: z.array(z.string()).min(1, "ต้องมีรูปอย่างน้อย 1 รูป").max(8, "ใส่รูปได้ไม่เกิน 8 รูป"),
  })
  .refine((v) => v.openTime !== v.closeTime, { path: ["closeTime"], message: "เวลาเปิดและปิดต้องไม่ตรงกัน" });

export type RestaurantValues = z.infer<typeof restaurantSchema>;

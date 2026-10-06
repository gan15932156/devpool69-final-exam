import { z } from "zod";

// กติกาเดียวกับที่ Go ตรวจใน internal/handlers/auth.go
// หน้าเว็บตรวจเพื่อ UX (บอกผิดทันที) · Go ตรวจซ้ำเสมอ เพราะคนยิง API ตรงได้

export const loginSchema = z.object({
  email: z.email("รูปแบบอีเมลไม่ถูกต้อง"),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, "กรุณากรอกชื่อที่แสดง").max(100, "ชื่อยาวเกินไป (ไม่เกิน 100 ตัวอักษร)"),
    email: z.email("รูปแบบอีเมลไม่ถูกต้อง"),
    password: z.string().min(8, "อย่างน้อย 8 ตัว").regex(/[0-9]/, "ต้องมีตัวเลข"),
    confirm: z.string(),
    agree: z.boolean().refine((v) => v, "กรุณายอมรับข้อกำหนด"),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "รหัสผ่านไม่ตรงกัน" });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;

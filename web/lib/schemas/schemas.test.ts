import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./auth";
import { MAX_CANCEL_LEAD_MINUTES, MAX_SEATS, restaurantSchema, type RestaurantValues } from "./restaurant";

// ข้อความ error ของช่องแรกที่ผิด (ไม่ผิด = undefined)
function firstError(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }, field: string) {
  return result.error?.issues.find((i) => i.path[0] === field)?.message;
}

describe("loginSchema", () => {
  it("ผ่าน", () => expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true));
  it("อีเมลผิด / รหัสว่าง", () => {
    const r = loginSchema.safeParse({ email: "a@", password: "" });
    expect(firstError(r, "email")).toBe("รูปแบบอีเมลไม่ถูกต้อง");
    expect(firstError(r, "password")).toBe("กรุณากรอกรหัสผ่าน");
  });
});

describe("registerSchema (กติกาเดียวกับ Register ใน Go)", () => {
  const ok = { name: "ต้น", email: "ton@example.com", password: "password1", confirm: "password1", agree: true };

  it("ผ่าน", () => expect(registerSchema.safeParse(ok).success).toBe(true));

  it.each([
    ["name", { name: "   " }, "กรุณากรอกชื่อที่แสดง"],
    ["name", { name: "ก".repeat(101) }, "ชื่อยาวเกินไป (ไม่เกิน 100 ตัวอักษร)"],
    ["email", { email: "ton" }, "รูปแบบอีเมลไม่ถูกต้อง"],
    ["password", { password: "abc1", confirm: "abc1" }, "อย่างน้อย 8 ตัว"],
    ["password", { password: "password", confirm: "password" }, "ต้องมีตัวเลข"],
    ["confirm", { confirm: "password2" }, "รหัสผ่านไม่ตรงกัน"],
    ["agree", { agree: false }, "กรุณายอมรับข้อกำหนด"],
  ])("%s ผิด → %s", (field, patch, message) => {
    expect(firstError(registerSchema.safeParse({ ...ok, ...patch }), field)).toBe(message);
  });

  it("ชื่อยาว 100 ตัวอักษรไทยพอดีผ่าน (นับตัวอักษร ไม่ใช่ byte)", () => {
    expect(registerSchema.safeParse({ ...ok, name: "ก".repeat(100) }).success).toBe(true);
  });
});

describe("restaurantSchema (กติกาเดียวกับ restaurantInput.validate ใน Go)", () => {
  const ok: RestaurantValues = {
    name: "ร้าน",
    cuisine: "",
    description: "",
    seats: 10,
    openTime: "18:00",
    closeTime: "02:00",
    cancelLeadMinutes: 30,
    images: ["/uploads/a.jpg"],
  };

  it("ผ่าน และตัดช่องว่างหน้าหลัง", () => {
    const r = restaurantSchema.safeParse({ ...ok, name: "  ร้าน  " });
    expect(r.success && r.data.name).toBe("ร้าน");
  });

  it.each([
    ["name", { name: " " }],
    ["name", { name: "ก".repeat(101) }],
    ["cuisine", { cuisine: "ก".repeat(101) }],
    ["description", { description: "ก".repeat(2001) }],
    ["seats", { seats: 0 }],
    ["seats", { seats: MAX_SEATS + 1 }],
    ["seats", { seats: 1.5 }],
    ["seats", { seats: Number.NaN }],
    ["cancelLeadMinutes", { cancelLeadMinutes: 29 }],
    ["cancelLeadMinutes", { cancelLeadMinutes: MAX_CANCEL_LEAD_MINUTES + 1 }],
    ["images", { images: [] }],
    ["images", { images: Array(9).fill("/uploads/a.jpg") }],
    ["closeTime", { closeTime: "18:00" }],
  ])("%s ผิด: %j", (field, patch) => {
    expect(firstError(restaurantSchema.safeParse({ ...ok, ...patch }), field)).toBeTruthy();
  });

  it("ขอบเขตที่ยังผ่าน", () => {
    for (const patch of [{ seats: 1 }, { seats: MAX_SEATS }, { cancelLeadMinutes: MAX_CANCEL_LEAD_MINUTES }, { images: Array(8).fill("/uploads/a.jpg") }]) {
      expect(restaurantSchema.safeParse({ ...ok, ...patch }).success).toBe(true);
    }
  });

  it("เพดานตรงกับ Go (api/internal/handlers/limits.go)", () => {
    expect(MAX_SEATS).toBe(1000);
    expect(MAX_CANCEL_LEAD_MINUTES).toBe(7 * 24 * 60);
  });
});

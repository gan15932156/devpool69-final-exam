import { beforeEach, describe, expect, it, vi } from "vitest";

// auth() ของ NextAuth / redirect() ของ Next ใช้นอก server จริงไม่ได้ → แทนด้วยตัวปลอม
const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

const { requireSession, safeCallbackUrl } = await import("./require-session");

describe("safeCallbackUrl (กัน open redirect)", () => {
  it.each([
    ["/bookings", "/bookings"],
    ["/restaurants/1?date=2026-09-25#book", "/restaurants/1?date=2026-09-25#book"],
    ["/", "/"],
  ])("path ในเว็บ %s → %s", (input, want) => expect(safeCallbackUrl(input)).toBe(want));

  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "\\\\evil.com",
    "javascript:alert(1)",
    "evil.com",
    "",
  ])("ไปเว็บอื่นไม่ได้: %j", (input) => {
    expect(safeCallbackUrl(input)).toBe("/");
  });

  it("ไม่ใช่สตริงเดียว → /", () => {
    expect(safeCallbackUrl(undefined)).toBe("/");
    expect(safeCallbackUrl(["/a", "/b"])).toBe("/");
  });

  it("path แปลก ๆ ที่ยังอยู่ในเว็บ ถูกทำให้เป็นรูปปกติ", () => {
    expect(safeCallbackUrl("/a/../bookings")).toBe("/bookings");
  });
});

describe("requireSession", () => {
  beforeEach(() => auth.mockReset());

  it("login แล้ว → คืน session", async () => {
    auth.mockResolvedValue({ user: { id: "1" } });
    await expect(requireSession("/bookings")).resolves.toEqual({ user: { id: "1" } });
  });

  it("ยังไม่ login → ไปหน้า login พร้อม callbackUrl ที่ encode แล้ว", async () => {
    auth.mockResolvedValue(null);
    await expect(requireSession("/owner/restaurants/1/edit?x=1&y=2")).rejects.toThrow(
      "REDIRECT /login?callbackUrl=%2Fowner%2Frestaurants%2F1%2Fedit%3Fx%3D1%26y%3D2",
    );
  });
});

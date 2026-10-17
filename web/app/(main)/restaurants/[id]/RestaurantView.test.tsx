// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { availability, restaurant } from "@/test/fixtures";
import { mockFetch, renderWithQuery } from "@/test/render";

const session = vi.fn();
vi.mock("next-auth/react", () => ({ useSession: () => session(), signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { RestaurantView } = await import("./RestaurantView");

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(2026, 8, 25, 10, 0), toFake: ["Date"] });
  session.mockReturnValue({ data: null, status: "unauthenticated" });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// r = null → Go ตอบ error ด้วย status ที่ให้
function setup(r: ReturnType<typeof restaurant> | null, status = 200) {
  return mockFetch([
    { path: "/api/v1/restaurants/1", status, body: r ?? { error: { code: status === 404 ? "NOT_FOUND" : "INTERNAL", message: "x" } } },
    { path: /\/availability\?/, body: availability(22) },
    { path: /\/reviews\?/, body: { total: 0, items: [], mine: null } },
  ]);
}

describe("RestaurantView", () => {
  it("ข้อมูลร้าน + ใบจอง + รีวิว", async () => {
    setup(restaurant({ description: "กับข้าวไทย", cancelLeadMinutes: 90 }));
    renderWithQuery(<RestaurantView id={1} />);
    expect(screen.getByText("กำลังโหลดร้าน…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 1, name: "ครัวริมคลอง" })).toBeInTheDocument();
    expect(screen.getByText("เปิด 11:00–22:00 ทุกวัน")).toBeInTheDocument();
    expect(screen.getByText("ยกเลิกล่วงหน้า 1 ชม. 30 นาที")).toBeInTheDocument();
    expect(screen.getByText("กับข้าวไทย")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ใบจองโต๊ะ" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "รีวิวจากลูกค้า" })).toBeInTheDocument();
    expect(screen.queryByText(/คุณเป็นเจ้าของร้านนี้/)).toBeNull();
  });

  it("ร้านข้ามเที่ยงคืน → ป้ายและคำอธิบาย", async () => {
    setup(restaurant({ openTime: "18:00", closeTime: "02:00", crossesMidnight: true }));
    renderWithQuery(<RestaurantView id={1} />);
    expect(await screen.findByText(/จองคืนวันศุกร์ได้ถึง 02:00 เช้าวันเสาร์/)).toBeInTheDocument();
    expect(screen.getByText("เปิดข้ามเที่ยงคืน")).toBeInTheDocument();
  });

  it("เจ้าของร้าน → แถบเจ้าของพร้อมลิงก์แก้ไขร้าน", async () => {
    session.mockReturnValue({ data: { user: { id: "9" } }, status: "authenticated" });
    setup(restaurant({ ownerId: 9 }));
    renderWithQuery(<RestaurantView id={1} />);
    expect(await screen.findByText(/คุณเป็นเจ้าของร้านนี้/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "แก้ไขร้าน" })).toHaveAttribute("href", "/owner/restaurants/1/edit");
  });

  it("ไม่มีร้าน (404) / โหลดไม่ได้ → ข้อความต่างกัน", async () => {
    setup(null, 404);
    const { unmount } = renderWithQuery(<RestaurantView id={1} />);
    expect(await screen.findByText("ไม่พบร้านนี้")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "กลับไปหน้าค้นหา" })).toHaveAttribute("href", "/");
    unmount();

    setup(null, 500);
    renderWithQuery(<RestaurantView id={1} />);
    expect(await screen.findByText("โหลดข้อมูลร้านไม่สำเร็จ")).toBeInTheDocument();
  });
});

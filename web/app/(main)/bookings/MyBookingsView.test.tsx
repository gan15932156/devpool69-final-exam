// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { booking } from "@/test/fixtures";
import { mockFetch, renderWithQuery } from "@/test/render";

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { id: "2" } }, status: "authenticated" }), signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { MyBookingsView } = await import("./MyBookingsView");

beforeEach(() => vi.useFakeTimers({ now: new Date(2026, 8, 25, 10, 0), toFake: ["Date"] }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const data = {
  upcoming: [booking({ id: 1, restaurantName: "ครัวริมคลอง" }), booking({ id: 2, restaurantName: "ส้มตำหน้าตลาด" })],
  past: [booking({ id: 3, restaurantName: "ข้าวมันไก่", serviceDate: "2026-09-01" })],
  cancelled: [],
};

describe("MyBookingsView", () => {
  it("แท็บบอกจำนวน · สลับแท็บไม่ยิง API ใหม่ · แท็บว่างมีข้อความ", async () => {
    const fetch = mockFetch([{ path: "/api/v1/me/bookings", body: data }]);
    renderWithQuery(<MyBookingsView />);
    expect(screen.getByText("กำลังโหลด…")).toBeInTheDocument();
    expect(await screen.findByRole("tab", { name: "กำลังจะถึง · 2" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("link", { name: "ครัวริมคลอง" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ส้มตำหน้าตลาด" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "ที่ผ่านมา · 1" }));
    expect(screen.getByRole("link", { name: "ข้าวมันไก่" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "ครัวริมคลอง" })).toBeNull();
    expect(screen.getByRole("link", { name: "เขียนรีวิว" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "ยกเลิกแล้ว · 0" }));
    expect(screen.getByText("ไม่มีการจองที่ยกเลิก")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("ยังไม่มีการจองที่กำลังจะถึง → ปุ่มไปหาร้าน", async () => {
    mockFetch([{ path: "/api/v1/me/bookings", body: { upcoming: [], past: [], cancelled: [] } }]);
    renderWithQuery(<MyBookingsView />);
    expect(await screen.findByText("ยังไม่มีการจองที่กำลังจะถึง")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ไปหาร้าน" })).toHaveAttribute("href", "/");
  });

  it("โหลดไม่สำเร็จ", async () => {
    mockFetch([{ path: "/api/v1/me/bookings", status: 500, body: { error: { code: "INTERNAL", message: "x" } } }]);
    renderWithQuery(<MyBookingsView />);
    expect(await screen.findByText("โหลดการจองไม่สำเร็จ")).toBeInTheDocument();
  });
});

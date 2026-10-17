// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RestaurantDetail } from "@/lib/types";
import { mockFetch, renderWithQuery, sentJSON } from "@/test/render";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const session = vi.fn();
vi.mock("next-auth/react", () => ({ useSession: () => session(), signOut: vi.fn() }));

const { BookingTicket } = await import("./BookingTicket");

const shop: RestaurantDetail = {
  id: 1,
  ownerId: 9,
  name: "ครัวริมคลอง",
  cuisine: "",
  description: "",
  seats: 10,
  openTime: "11:00",
  closeTime: "14:00",
  crossesMidnight: false,
  cancelLeadMinutes: 30,
  images: [],
  avgRating: null,
  reviewCount: 0,
  hasEnoughReviews: false,
  distribution: {},
};

// availability ของร้าน 11:00–14:00 (6 ช่อง)
const av = (used: number[], date = "2026-09-25") => ({ date, seats: 10, slots: used.map((u, i) => ({ start: String(i), used: u, past: false })) });
const avPath = /\/api\/v1\/restaurants\/1\/availability\?date=/;

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(2026, 8, 25, 10, 0), toFake: ["Date"] }); // ศ. 25 ก.ย. 10:00
  session.mockReturnValue({ data: { user: { id: "2" } }, status: "authenticated" });
  push.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const confirmButton = () => screen.getByRole("button", { name: "ยืนยันการจอง" });

describe("BookingTicket", () => {
  it("ยังไม่ login → ปุ่มไปหน้า login แล้วกลับมาหน้าร้านนี้", async () => {
    session.mockReturnValue({ data: null, status: "unauthenticated" });
    mockFetch([{ path: avPath, body: av([0, 0, 0, 0, 0, 0]) }]);
    renderWithQuery(<BookingTicket restaurant={shop} />);
    expect(screen.getByRole("link", { name: "เข้าสู่ระบบเพื่อจอง" })).toHaveAttribute("href", "/login?callbackUrl=/restaurants/1");
    expect(screen.queryByRole("button", { name: "ยืนยันการจอง" })).toBeNull();
  });

  it("ค่าเริ่มต้น 2 คน · วันนี้ · ช่วงแรกที่ยังไม่ผ่าน 1 ชม. → จองแล้วไปหน้า /bookings", async () => {
    const fetch = mockFetch([
      { path: avPath, body: av([3, 0, 0, 0, 0, 0]) },
      { method: "POST", path: "/api/v1/restaurants/1/bookings", status: 201, body: { id: 5 } },
    ]);
    renderWithQuery(<BookingTicket restaurant={shop} />);

    expect(screen.getByText("ศ. 25 ก.ย. 2569 · 11:00–12:00 · 2 คน")).toBeInTheDocument();
    expect(fetch.mock.calls[0][0]).toBe("/api/v1/restaurants/1/availability?date=2026-09-25");
    expect(await screen.findByText("ที่นั่งพอ — ช่วงที่แน่นที่สุดยังเหลือ 5 ที่")).toBeInTheDocument();
    expect(screen.getByText("ยกเลิกได้ถึง 10:30 ของวันที่จอง (ร้านกำหนดล่วงหน้า 30 นาที)")).toBeInTheDocument();

    await userEvent.click(confirmButton());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/bookings"));
    const post = fetch.mock.calls.findIndex(([, init]) => init?.method === "POST");
    expect(sentJSON(fetch, post)).toEqual({ date: "2026-09-25", start: "11:00", end: "12:00", partySize: 2 });
  });

  it("ที่นั่งไม่พอ → ปุ่มจองปิด · ลดคนลงแล้วจองได้", async () => {
    mockFetch([{ path: avPath, body: av([9, 0, 0, 0, 0, 0]) }]);
    renderWithQuery(<BookingTicket restaurant={shop} />);
    expect(await screen.findByText(/ที่นั่งไม่พอ: ช่วง 11:00–11:30 ร้านรับได้ 10 ที่ จองไปแล้ว 9 \+ คุณจองเพิ่ม 2 = 11 คน เกินไป 1 คน/)).toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "ลดจำนวนคน" }));
    expect(await screen.findByText("ที่นั่งพอดี — ช่วงที่แน่นที่สุดจะเต็ม 10/10")).toBeInTheDocument();
    expect(confirmButton()).toBeEnabled();
  });

  it("จำนวนคนเพิ่มได้ไม่เกินที่นั่งร้าน", async () => {
    mockFetch([{ path: avPath, body: av([0, 0, 0, 0, 0, 0]) }]);
    renderWithQuery(<BookingTicket restaurant={{ ...shop, seats: 3 }} />);
    const plus = screen.getByRole("button", { name: "เพิ่มจำนวนคน" });
    await userEvent.click(plus);
    expect(screen.getByText("3 คน")).toBeInTheDocument();
    expect(plus).toBeDisabled();
  });

  it("Go ตอบ 409 (มีคนจองตัดหน้า) → แสดงข้อความจาก details · เปลี่ยนค่าแล้วข้อความหาย", async () => {
    const details = { slotStart: "11:30", slotEnd: "12:00", used: 9, party: 2, seats: 10 };
    const fetch = mockFetch([
      { path: avPath, body: av([0, 0, 0, 0, 0, 0]) },
      { method: "POST", path: "/api/v1/restaurants/1/bookings", status: 409, body: { error: { code: "SEATS_EXCEEDED", message: "ที่นั่งไม่พอ", details } } },
    ]);
    renderWithQuery(<BookingTicket restaurant={shop} />);
    await screen.findByText(/ที่นั่งพอ/);
    await userEvent.click(confirmButton());

    const alert = await screen.findByText("ที่นั่งไม่พอ: ช่วง 11:30–12:00 ร้านรับได้ 10 ที่ จองไปแล้ว 9 + คุณจองเพิ่ม 2 = 11 คน เกินไป 1 คน");
    expect(alert).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    // โหลดกราฟที่นั่งใหม่หลัง error
    await waitFor(() => expect(fetch.mock.calls.filter(([url]) => avPath.test(url))).toHaveLength(2));

    await userEvent.click(screen.getByRole("button", { name: "ลดจำนวนคน" }));
    expect(screen.queryByText(alert.textContent!)).toBeNull();
  });

  it("วันนี้ร้านปิดไปแล้ว → เริ่มที่พรุ่งนี้", async () => {
    vi.setSystemTime(new Date(2026, 8, 25, 15, 0)); // หลังร้านปิด 14:00
    const fetch = mockFetch([{ path: avPath, body: av([0, 0, 0, 0, 0, 0], "2026-09-26") }]);
    renderWithQuery(<BookingTicket restaurant={shop} />);
    expect(screen.getByText("ส. 26 ก.ย. 2569 · 11:00–12:00 · 2 คน")).toBeInTheDocument();
    expect(fetch.mock.calls[0][0]).toContain("date=2026-09-26");
    const dates = screen.getByRole("group", { name: "เลือกวันที่" });
    expect(within(dates).getByRole("button", { pressed: true })).toHaveTextContent("26");
  });

  it("เลือกวันอื่น → โหลดที่นั่งของวันนั้น", async () => {
    const fetch = mockFetch([{ path: avPath, body: av([0, 0, 0, 0, 0, 0]) }]);
    renderWithQuery(<BookingTicket restaurant={shop} />);
    const dates = screen.getByRole("group", { name: "เลือกวันที่" });
    await userEvent.click(within(dates).getByRole("button", { name: /27/ }));
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => url.endsWith("date=2026-09-27"))).toBe(true));
    expect(screen.getByText("อา. 27 ก.ย. 2569 · 11:00–12:00 · 2 คน")).toBeInTheDocument();
  });

  it("ร้านข้ามเที่ยงคืน: เลือกเวลาจบหลังเที่ยงคืน ส่งเป็นเวลาบนหน้าปัด", async () => {
    const night = { ...shop, openTime: "22:00", closeTime: "02:00", crossesMidnight: true };
    const fetch = mockFetch([
      { path: avPath, body: av([0, 0, 0, 0, 0, 0, 0, 0]) },
      { method: "POST", path: "/api/v1/restaurants/1/bookings", status: 201, body: { id: 5 } },
    ]);
    renderWithQuery(<BookingTicket restaurant={night} />);
    await screen.findByText(/ที่นั่งพอ/);
    await userEvent.selectOptions(screen.getByLabelText("สิ้นสุด"), "01:30");
    expect(screen.getByText("ศ. 25 ก.ย. 2569 · 22:00–01:30 · 2 คน")).toBeInTheDocument();
    await userEvent.click(confirmButton());
    await waitFor(() => expect(push).toHaveBeenCalled());
    const post = fetch.mock.calls.findIndex(([, init]) => init?.method === "POST");
    expect(sentJSON(fetch, post)).toEqual({ date: "2026-09-25", start: "22:00", end: "01:30", partySize: 2 });
  });
});

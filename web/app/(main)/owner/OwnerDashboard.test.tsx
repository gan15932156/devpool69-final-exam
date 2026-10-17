// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { availability, restaurant } from "@/test/fixtures";
import { mockFetch, renderWithQuery } from "@/test/render";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { id: "9" } }, status: "authenticated" }), signOut: vi.fn() }));

const { OwnerDashboard } = await import("./OwnerDashboard");

const krua = restaurant({ id: 1, name: "ครัวริมคลอง", avgRating: 4.8, reviewCount: 126 });
const night = restaurant({ id: 2, name: "ข้าวต้มท่าน้ำ", openTime: "18:00", closeTime: "02:00", crossesMidnight: true, seats: 20, cancelLeadMinutes: 30 });

const ownerBookings = [
  { id: 1, customerName: "สมชาย", partySize: 7, start: "12:00", end: "13:00", status: "confirmed" },
  { id: 2, customerName: "มะลิ", partySize: 3, start: "12:00", end: "13:00", status: "confirmed" },
  { id: 3, customerName: "แก้ว", partySize: 4, start: "18:00", end: "19:00", status: "cancelled" },
];

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(2026, 8, 25, 10, 0), toFake: ["Date"] });
  replace.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function setup(shops: object[], initialId?: number) {
  const fetch = mockFetch([
    { path: "/api/v1/me/restaurants", body: shops },
    { path: /\/restaurants\/1\/availability/, body: availability(22, { 2: 10, 3: 10 }) },
    { path: /\/restaurants\/1\/bookings\?date=2026-09-25/, body: ownerBookings },
    { path: /\/restaurants\/1\/bookings/, body: [] },
    { path: /\/restaurants\/2\/availability/, body: availability(16, { 13: 5 }, 20) },
    { path: /\/restaurants\/2\/bookings/, body: [{ id: 9, customerName: "เฮียชัย", partySize: 5, start: "00:30", end: "01:30", status: "confirmed" }] },
  ]);
  renderWithQuery(<OwnerDashboard initialId={initialId} />);
  return fetch;
}

const stat = (label: string | RegExp) => screen.getByText(label).parentElement!;

describe("OwnerDashboard", () => {
  it("ยังไม่มีร้าน → ชวนสร้างร้านแรก", async () => {
    setup([]);
    expect(await screen.findByText("ยังไม่มีร้านของคุณ")).toBeInTheDocument();
    expect(screen.getByText("ยังไม่มีร้าน")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "สร้างร้าน" })).toHaveAttribute("href", "/owner/restaurants/new");
  });

  it("เลือกร้านแรก · สรุปตัวเลขของวันนี้ไม่นับที่ยกเลิก · ตารางแสดงครบ", async () => {
    setup([krua, night]);
    expect(await screen.findByRole("heading", { name: "ครัวริมคลอง" })).toBeInTheDocument();
    expect(screen.getByText("คุณเป็นเจ้าของ 2 ร้าน · แก้ไขหรือลบได้เฉพาะร้านของคุณเอง")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ครัวริมคลอง/ })).toHaveAttribute("aria-pressed", "true");

    await screen.findByText("สมชาย");
    expect(stat("การจอง · ศ. 25 ก.ย. 2569")).toHaveTextContent("2รายการ · 10 คน");
    expect(stat("คะแนนเฉลี่ย")).toHaveTextContent("4.8126 รีวิว");
    expect(stat("ยกเลิกล่วงหน้า")).toHaveTextContent("60นาที");
    expect(await screen.findByText("ช่วงที่แน่นที่สุด 10/10 ที่")).toBeInTheDocument();

    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows.map((r) => r.textContent)).toEqual([
      "12:00–13:00สมชาย7 คนยืนยันแล้ว",
      "12:00–13:00มะลิ3 คนยืนยันแล้ว",
      "18:00–19:00แก้ว4 คนยกเลิกแล้ว",
    ]);
    expect(screen.getByRole("link", { name: "แก้ไขร้าน" })).toHaveAttribute("href", "/owner/restaurants/1/edit");
    expect(screen.getByRole("link", { name: "ดูหน้าร้าน" })).toHaveAttribute("href", "/restaurants/1");
  });

  it("เปลี่ยนวัน → โหลดข้อมูลวันนั้น · ไม่มีการจองบอกว่าว่าง", async () => {
    const fetch = setup([krua]);
    await screen.findByText("สมชาย");
    await userEvent.click(within(screen.getByRole("group", { name: "เลือกวันที่" })).getByRole("button", { name: /26/ }));
    expect(await screen.findByText("ยังไม่มีการจองในวันนี้")).toBeInTheDocument();
    expect(fetch.mock.calls.map(([u]) => u)).toEqual(
      expect.arrayContaining(["/api/v1/restaurants/1/availability?date=2026-09-26", "/api/v1/restaurants/1/bookings?date=2026-09-26"]),
    );
    expect(stat("การจอง · ส. 26 ก.ย. 2569")).toHaveTextContent("0รายการ · 0 คน");
  });

  it("เลือกร้านอื่น → จำใน URL · ร้านข้ามเที่ยงคืนมีคำอธิบาย", async () => {
    setup([krua, night]);
    await screen.findByText("สมชาย");
    await userEvent.click(screen.getByRole("button", { name: /ข้าวต้มท่าน้ำ/ }));
    expect(replace).toHaveBeenCalledWith("/owner?r=2", { scroll: false });
    expect(await screen.findByText("เฮียชัย")).toBeInTheDocument();
    expect(screen.getAllByText("เปิดข้ามเที่ยงคืน").length).toBeGreaterThan(0);
    expect(screen.getByText(/ช่วงหลัง 00:00 นับเป็นรอบเปิดของคืนเดียวกัน \(เวลาปิด 02:00 คือของวันถัดไป\)/)).toBeInTheDocument();
    expect(await screen.findByText("ช่วงที่แน่นที่สุด 5/20 ที่")).toBeInTheDocument();
  });

  it("?r= ชี้ร้านที่มีอยู่ → เปิดร้านนั้น · ชี้ร้านที่ไม่ใช่ของเรา → ใช้ร้านแรก", async () => {
    setup([krua, night], 2);
    expect(await screen.findByRole("heading", { name: "ข้าวต้มท่าน้ำ" })).toBeInTheDocument();
  });

  it("?r= ไม่ตรงร้านไหน → ร้านแรก", async () => {
    setup([krua, night], 999);
    expect(await screen.findByRole("heading", { name: "ครัวริมคลอง" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("สมชาย")).toBeInTheDocument());
  });
});

// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { availability, booking, restaurant } from "@/test/fixtures";
import { mockFetch, renderWithQuery, sentJSON } from "@/test/render";

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { id: "2" } }, status: "authenticated" }), signOut: vi.fn() }));

const { EditBookingDialog } = await import("./EditBookingDialog");

// ตัวอย่างจากโจทย์: ร้าน 10 ที่ · เราจอง 7 · คนอื่น 3 (ช่อง 12:00 และ 12:30) → แก้เป็น 8 ✕ · แก้เป็น 5 ✓
const shop = restaurant({ seats: 10, openTime: "11:00", closeTime: "22:00" });
const mine = booking({ partySize: 7, serviceDate: "2026-09-26", start: "12:00", end: "13:00" });
const othersOnly = availability(22, { 2: 3, 3: 3 }); // Go ไม่นับการจองนี้ (excludeBookingId)

beforeEach(() => vi.useFakeTimers({ now: new Date(2026, 8, 25, 10, 0), toFake: ["Date"] }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function setup(routes: Parameters<typeof mockFetch>[0] = [], b = mine, r = shop) {
  const fetch = mockFetch([
    { path: `/api/v1/restaurants/${r.id}`, body: r },
    { path: /\/availability\?/, body: othersOnly },
    ...routes,
  ]);
  const onClose = vi.fn();
  const utils = renderWithQuery(<EditBookingDialog booking={b} onClose={onClose} />);
  return { fetch, onClose, ...utils };
}

const save = () => screen.getByRole("button", { name: "บันทึกการแก้ไข" });
// ข้อความผลตรวจที่นั่ง (<p role="status">) · <output> ของจำนวนคนก็มี role status จึงเลือกเฉพาะ <p>
const status = () => screen.getAllByRole("status").find((el) => el.tagName === "P")!;

describe("EditBookingDialog", () => {
  it("เปิดเป็น dialog · โหลดร้านแล้วแสดงค่าเดิม · ถามที่นั่งโดยไม่นับการจองนี้", async () => {
    const { fetch } = setup();
    expect(screen.getByRole("dialog", { name: "แก้ไขใบจอง" })).toBeInTheDocument();
    expect(screen.getByText("กำลังโหลด…")).toBeInTheDocument();
    expect(await screen.findByText("ส. 26 ก.ย. 2569 · 12:00–13:00 · 7 คน")).toBeInTheDocument();
    expect(screen.getByText("ครัวริมคลอง · ร้านมี 10 ที่นั่ง")).toBeInTheDocument();
    await waitFor(() => expect(status()).toHaveTextContent("ที่นั่งพอ — คนอื่น 3 + คุณ 7 = 10 ที่ เต็มพอดี"));
    expect(fetch.mock.calls.map(([url]) => url)).toContain("/api/v1/restaurants/1/availability?date=2026-09-26&excludeBookingId=7");
    expect(screen.getByText("10 / 10 ที่")).toBeInTheDocument();
  });

  it("แก้ 7 → 8 = 3 + 8 = 11 เกิน → บันทึกไม่ได้", async () => {
    setup();
    await waitFor(() => expect(status()).toHaveTextContent("เต็มพอดี"));
    await userEvent.click(screen.getByRole("button", { name: "เพิ่มจำนวนคน" }));
    expect(status()).toHaveTextContent("ที่นั่งไม่พอ: ช่วง 12:00–12:30 ร้านรับได้ 10 ที่ คนอื่นจองไปแล้ว 3 + คุณขอ 8 = 11 คน เกินไป 1 คน");
    expect(screen.getByText("11 / 10 ที่")).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it("แก้ 7 → 5 = 3 + 5 = 8 ✓ → PUT แล้วปิด dialog", async () => {
    const { fetch, onClose } = setup([{ method: "PUT", path: "/api/v1/bookings/7", body: mine }]);
    await waitFor(() => expect(status()).toHaveTextContent("เต็มพอดี"));
    const minus = screen.getByRole("button", { name: "ลดจำนวนคน" });
    await userEvent.click(minus);
    await userEvent.click(minus);
    expect(status()).toHaveTextContent("ที่นั่งพอ — คนอื่น 3 + คุณ 5 = 8 ที่ เหลือว่าง 2 ที่");
    await userEvent.click(save());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const put = fetch.mock.calls.findIndex(([, init]) => init?.method === "PUT");
    expect(sentJSON(fetch, put)).toEqual({ date: "2026-09-26", start: "12:00", end: "13:00", partySize: 5 });
  });

  it("Go ตอบ 409 → dialog ยังเปิดอยู่และบอกเหตุผล", async () => {
    const details = { slotStart: "12:00", slotEnd: "12:30", used: 6, party: 5, seats: 10 };
    const { onClose } = setup([
      { method: "PUT", path: "/api/v1/bookings/7", status: 409, body: { error: { code: "SEATS_EXCEEDED", message: "ที่นั่งไม่พอ", details } } },
    ]);
    await waitFor(() => expect(status()).toHaveTextContent("เต็มพอดี"));
    await userEvent.click(screen.getByRole("button", { name: "ลดจำนวนคน" }));
    await userEvent.click(screen.getByRole("button", { name: "ลดจำนวนคน" }));
    await userEvent.click(save());
    expect(await screen.findByText("ที่นั่งไม่พอ: ช่วง 12:00–12:30 ร้านรับได้ 10 ที่ คนอื่นจองไปแล้ว 6 + คุณขอ 5 = 11 คน เกินไป 1 คน")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("ปุ่มปิด และ ไม่บันทึก → onClose ไม่ยิง PUT", async () => {
    const { fetch, onClose, unmount } = setup();
    await userEvent.click(screen.getByRole("button", { name: "ปิด" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();

    const second = setup();
    await screen.findByText("ส. 26 ก.ย. 2569 · 12:00–13:00 · 7 คน");
    await userEvent.click(screen.getByRole("button", { name: "ไม่บันทึก" }));
    expect(second.onClose).toHaveBeenCalledTimes(1);
    expect([...fetch.mock.calls, ...second.fetch.mock.calls].some(([, init]) => init?.method === "PUT")).toBe(false);
  });

  it("ร้านข้ามเที่ยงคืน: เวลาหลังเที่ยงคืนของการจองเดิมแสดงถูก และส่งกลับเป็นเวลาบนหน้าปัด", async () => {
    const night = restaurant({ openTime: "22:00", closeTime: "02:00", crossesMidnight: true });
    const b = booking({ partySize: 2, start: "23:30", end: "01:00" });
    const { fetch } = setup([{ method: "PUT", path: "/api/v1/bookings/7", body: b }], b, night);
    await screen.findByText("ส. 26 ก.ย. 2569 · 23:30–01:00 · 2 คน");
    expect(screen.getByLabelText("เริ่ม")).toHaveDisplayValue("23:30");
    expect(screen.getByLabelText("สิ้นสุด")).toHaveDisplayValue("01:00");
    await userEvent.selectOptions(screen.getByLabelText("สิ้นสุด"), "02:00");
    await waitFor(() => expect(save()).toBeEnabled());
    await userEvent.click(save());
    await waitFor(() => expect(fetch.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(true));
    const put = fetch.mock.calls.findIndex(([, init]) => init?.method === "PUT");
    expect(sentJSON(fetch, put)).toEqual({ date: "2026-09-26", start: "23:30", end: "02:00", partySize: 2 });
  });

  it("การจองที่อยู่ไกลกว่า 5 วัน → วันเดิมยังอยู่ในตัวเลือกและถูกเลือกไว้", async () => {
    setup([], booking({ serviceDate: "2026-10-20" }));
    const select = await screen.findByLabelText("วันที่");
    expect(select).toHaveDisplayValue("อ. 20 ต.ค. 2569");
    expect((select as HTMLSelectElement).options[0].value).toBe("2026-10-20");
  });

  it("เปลี่ยนวัน → ถามที่นั่งของวันใหม่", async () => {
    const { fetch } = setup();
    const select = await screen.findByLabelText("วันที่");
    await userEvent.selectOptions(select, "2026-09-27");
    await waitFor(() =>
      expect(fetch.mock.calls.map(([url]) => url)).toContain("/api/v1/restaurants/1/availability?date=2026-09-27&excludeBookingId=7"),
    );
  });
});

// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Booking } from "@/lib/types";
import { mockFetch, renderWithQuery } from "@/test/render";

const signOut = vi.fn();
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { id: "2" } }, status: "authenticated" }), signOut: (...a: unknown[]) => signOut(...a) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { BookingStub } = await import("./BookingStub");

const base: Booking = {
  id: 7,
  restaurantId: 1,
  restaurantName: "ครัวริมคลอง",
  partySize: 4,
  serviceDate: "2026-09-26",
  start: "18:00",
  end: "19:30",
  status: "confirmed",
  cancelDeadline: "17:00",
  cancelDeadlineDate: "2026-09-26",
  cancelLeadMinutes: 60,
  canCancel: true,
  hasReviewed: false,
};

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(2026, 8, 25, 10, 0), toFake: ["Date"] });
  signOut.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("BookingStub", () => {
  it("กำลังจะถึง: บอกเส้นตาย และกดแก้ไข/ยกเลิกได้", () => {
    renderWithQuery(<BookingStub booking={base} kind="upcoming" />);
    expect(screen.getByRole("link", { name: "ครัวริมคลอง" })).toHaveAttribute("href", "/restaurants/1");
    expect(screen.getByText("ยืนยันแล้ว")).toBeInTheDocument();
    expect(screen.getByText("18:00–19:30")).toBeInTheDocument();
    expect(screen.getByText("แก้ไข/ยกเลิกได้ถึง ส. 26 ก.ย. 2569 17:00 · ร้านกำหนดล่วงหน้า 1 ชั่วโมง")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "แก้ไข" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /ยกเลิก/ })).toBeEnabled();
  });

  it("เลยเส้นตาย (canCancel จาก Go) → ปุ่มปิดและบอกเหตุผล", () => {
    renderWithQuery(<BookingStub booking={{ ...base, canCancel: false }} kind="upcoming" />);
    expect(screen.getByText(/เลยเวลายกเลิกแล้ว · ร้านนี้ให้ยกเลิกล่วงหน้า 1 ชั่วโมง \(ถึง 17:00\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "แก้ไข" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /ยกเลิก/ })).toBeDisabled();
  });

  it("วันนี้ → ต้นขั้วขึ้นว่า วันนี้", () => {
    renderWithQuery(<BookingStub booking={{ ...base, serviceDate: "2026-09-25" }} kind="upcoming" />);
    expect(screen.getByText("วันนี้")).toBeInTheDocument();
  });

  it("ที่ผ่านมา: ยังไม่รีวิว → ปุ่มเขียนรีวิว · รีวิวแล้ว → ป้าย", () => {
    const { unmount } = renderWithQuery(<BookingStub booking={base} kind="past" />);
    expect(screen.getByText("ผ่านไปแล้ว")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เขียนรีวิว" })).toHaveAttribute("href", "/restaurants/1#review");
    expect(screen.queryByRole("button", { name: "แก้ไข" })).toBeNull();
    unmount();
    renderWithQuery(<BookingStub booking={{ ...base, hasReviewed: true }} kind="past" />);
    expect(screen.getByText("รีวิวแล้ว")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "เขียนรีวิว" })).toBeNull();
  });

  it("ยกเลิกแล้ว", () => {
    renderWithQuery(<BookingStub booking={{ ...base, status: "cancelled" }} kind="cancelled" />);
    expect(screen.getByText("ยกเลิกแล้ว")).toBeInTheDocument();
    expect(screen.getByText("ยกเลิกเรียบร้อย ร้านได้ที่นั่งคืนแล้ว")).toBeInTheDocument();
  });

  it("ยกเลิก 2 ขั้น: กดครั้งแรกยังไม่ยิง API · กด ไม่ยกเลิก แล้วกลับเหมือนเดิม", async () => {
    const fetch = mockFetch([]);
    renderWithQuery(<BookingStub booking={base} kind="upcoming" />);
    await userEvent.click(screen.getByRole("button", { name: /ยกเลิก/ }));
    expect(screen.getByRole("alertdialog", { name: "ยืนยันการยกเลิก" })).toHaveTextContent("ที่นั่ง 4 คนจะถูกคืนให้ร้านทันที");
    expect(fetch).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "ไม่ยกเลิก" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("ยืนยันยกเลิก → POST แล้วโหลดรายการใหม่", async () => {
    const fetch = mockFetch([{ method: "POST", path: "/api/v1/bookings/7/cancel", body: { ...base, status: "cancelled" } }]);
    const { queryClient } = renderWithQuery(<BookingStub booking={base} kind="upcoming" />);
    queryClient.setQueryData(["my-bookings"], {});
    await userEvent.click(screen.getByRole("button", { name: /ยกเลิก/ }));
    await userEvent.click(screen.getByRole("button", { name: "ยืนยันยกเลิก" }));
    await waitFor(() => expect(queryClient.getQueryState(["my-bookings"])?.isInvalidated).toBe(true));
    expect(fetch).toHaveBeenCalledWith("/api/v1/bookings/7/cancel", expect.objectContaining({ method: "POST" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("Go ตอบ 409 (เลยเวลาระหว่างเปิดหน้าทิ้งไว้) → แสดงข้อความของ Go", async () => {
    mockFetch([
      { method: "POST", path: "/api/v1/bookings/7/cancel", status: 409, body: { error: { code: "CANCEL_WINDOW_PASSED", message: "เลยเวลาที่ร้านให้แก้ไขหรือยกเลิกแล้ว" } } },
    ]);
    renderWithQuery(<BookingStub booking={base} kind="upcoming" />);
    await userEvent.click(screen.getByRole("button", { name: /ยกเลิก/ }));
    await userEvent.click(screen.getByRole("button", { name: "ยืนยันยกเลิก" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("เลยเวลาที่ร้านให้แก้ไขหรือยกเลิกแล้ว");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("Go ตอบ 401 ตอน login อยู่ (token ถูกยกเลิก) → ออกจากระบบไปหน้า login", async () => {
    mockFetch([{ method: "POST", path: "/api/v1/bookings/7/cancel", status: 401, body: { error: { code: "UNAUTHORIZED", message: "กรุณาเข้าสู่ระบบ" } } }]);
    renderWithQuery(<BookingStub booking={base} kind="upcoming" />);
    await userEvent.click(screen.getByRole("button", { name: /ยกเลิก/ }));
    await userEvent.click(screen.getByRole("button", { name: "ยืนยันยกเลิก" }));
    await waitFor(() => expect(signOut).toHaveBeenCalledWith({ redirectTo: "/login" }));
  });
});

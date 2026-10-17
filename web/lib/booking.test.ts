import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import {
  atMinutes,
  bookingErrorText,
  checkSeats,
  dateParts,
  invalidateBookingQueries,
  isoDate,
  nextDays,
  seatsExceededText,
  seatText,
  serviceRange,
  thaiDate,
  timeOptions,
  type Availability,
} from "./booking";

// availability ของร้าน open (นาที) ที่จองแล้วตามลำดับช่อง
function av(seats: number, used: number[]): Availability {
  return { date: "2026-09-25", seats, slots: used.map((u, i) => ({ start: String(i), used: u, past: false })) };
}

afterEach(() => vi.useRealTimers());

describe("serviceRange", () => {
  it("ร้านปกติ", () => expect(serviceRange("11:00", "22:00")).toEqual({ open: 660, close: 1320 }));
  it("ข้ามเที่ยงคืน → close เกิน 1440", () => expect(serviceRange("18:00", "02:00")).toEqual({ open: 1080, close: 1560 }));
  it("ปิดเที่ยงคืนพอดี", () => expect(serviceRange("18:00", "00:00")).toEqual({ open: 1080, close: 1440 }));
});

describe("timeOptions", () => {
  it("ทุก 30 นาที รวมปลาย · ป้ายวนกลับหลังเที่ยงคืน", () => {
    expect(timeOptions(1380, 1500)).toEqual([
      { minutes: 1380, label: "23:00" },
      { minutes: 1410, label: "23:30" },
      { minutes: 1440, label: "00:00" },
      { minutes: 1470, label: "00:30" },
      { minutes: 1500, label: "01:00" },
    ]);
  });
  it("from > to → ว่าง", () => expect(timeOptions(600, 570)).toEqual([]));
});

describe("วันที่", () => {
  it("atMinutes: นาทีเกินวันไปเป็นวันถัดไป", () => {
    expect(atMinutes("2026-09-25", 1530)).toEqual(new Date(2026, 8, 26, 1, 30));
    expect(atMinutes("2026-12-31", 1440)).toEqual(new Date(2027, 0, 1, 0, 0));
  });

  it("isoDate เติมศูนย์", () => expect(isoDate(new Date(2026, 0, 5))).toBe("2026-01-05"));

  it("nextDays: วันนี้ + ข้ามเดือน", () => {
    const days = nextDays(3, new Date(2026, 8, 29, 23, 59)); // อ. 29 ก.ย.
    expect(days).toEqual([
      { iso: "2026-09-29", dow: "อ.", day: 29, sub: "วันนี้" },
      { iso: "2026-09-30", dow: "พ.", day: 30, sub: "ก.ย." },
      { iso: "2026-10-01", dow: "พฤ.", day: 1, sub: "ต.ค." },
    ]);
  });

  it("thaiDate ใช้ปี พ.ศ.", () => {
    expect(thaiDate("2026-09-26")).toBe("ส. 26 ก.ย. 2569");
    expect(thaiDate("2026-09-26", false)).toBe("26 ก.ย. 2569");
  });

  it("dateParts รู้ว่าวันไหนคือวันนี้", () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 25, 10, 0) });
    expect(dateParts("2026-09-25")).toEqual({ dow: "ศ.", day: 25, mon: "ก.ย. 69", isToday: true });
    expect(dateParts("2026-09-26").isToday).toBe(false);
  });
});

describe("checkSeats (ตรรกะเดียวกับ CheckSeats ใน Go)", () => {
  // ร้าน 10 ที่ เปิด 12:00 (720) · ช่อง 12:00 มี 7 · 12:30 มี 7 · 13:00 ว่าง
  const a = av(10, [7, 7, 0, 0]);

  it("นับทีละช่อง: 7 + 7 ไม่ซ้อนกัน → เพิ่มได้อีก 3", () => {
    const c = checkSeats(a, 720, 3, 720, 780);
    expect(c.firstOver).toBeNull();
    expect(c.peak).toBe(7);
  });

  it("เกิน → บอกช่องแรกที่เกิน และระบายแดงทุกช่องที่เกิน", () => {
    const c = checkSeats(a, 720, 4, 720, 840);
    expect(c.firstOver).toEqual({ start: 720, used: 7 });
    expect(c.over(720)).toBe(true);
    expect(c.over(750)).toBe(true);
    expect(c.over(780)).toBe(false);
  });

  it("ช่องที่เริ่มตรงเวลาจบไม่นับ", () => {
    const c = checkSeats(av(10, [0, 10]), 720, 1, 720, 750);
    expect(c.firstOver).toBeNull();
    expect(c.inRange(720)).toBe(true);
    expect(c.inRange(750)).toBe(false);
  });

  it("ช่องนอกช่วงที่ขอไม่นับ แม้จะเต็ม", () => {
    const c = checkSeats(av(10, [10, 0, 0, 10]), 720, 5, 750, 810);
    expect(c.firstOver).toBeNull();
    expect(c.peak).toBe(0);
  });

  it("เต็มพอดีไม่ถือว่าเกิน", () => expect(checkSeats(av(10, [7]), 720, 3, 720, 750).firstOver).toBeNull());

  it("ร้านข้ามเที่ยงคืน: นาทีเกิน 1440", () => {
    const night = av(4, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3]); // ช่องที่ 12 = 1080 + 360 = 1440 (00:00)
    expect(checkSeats(night, 1080, 2, 1440, 1500).firstOver).toEqual({ start: 1440, used: 3 });
  });
});

describe("ข้อความที่นั่ง", () => {
  const d = { slotStart: "12:00", slotEnd: "12:30", used: 7, party: 4, seats: 10 };

  it("seatsExceededText จองใหม่ / แก้ไข", () => {
    expect(seatsExceededText(d, "new")).toBe(
      "ที่นั่งไม่พอ: ช่วง 12:00–12:30 ร้านรับได้ 10 ที่ จองไปแล้ว 7 + คุณจองเพิ่ม 4 = 11 คน เกินไป 1 คน",
    );
    expect(seatsExceededText({ ...d, used: 3, party: 8 }, "edit")).toBe(
      "ที่นั่งไม่พอ: ช่วง 12:00–12:30 ร้านรับได้ 10 ที่ คนอื่นจองไปแล้ว 3 + คุณขอ 8 = 11 คน เกินไป 1 คน",
    );
  });

  it("seatText ตอนเกิน = ข้อความเดียวกับตอน Go ตอบ 409", () => {
    const c = checkSeats(av(10, [7]), 720, 4, 720, 750);
    expect(seatText(c, 4, "new")).toBe(seatsExceededText(d, "new"));
  });

  it("seatText ตอนพอ", () => {
    expect(seatText(checkSeats(av(10, [5]), 720, 2, 720, 750), 2, "new")).toBe("ที่นั่งพอ — ช่วงที่แน่นที่สุดยังเหลือ 3 ที่");
    expect(seatText(checkSeats(av(10, [8]), 720, 2, 720, 750), 2, "new")).toBe("ที่นั่งพอดี — ช่วงที่แน่นที่สุดจะเต็ม 10/10");
    expect(seatText(checkSeats(av(10, [3]), 720, 5, 720, 750), 5, "edit")).toBe("ที่นั่งพอ — คนอื่น 3 + คุณ 5 = 8 ที่ เหลือว่าง 2 ที่");
    expect(seatText(checkSeats(av(10, [3]), 720, 7, 720, 750), 7, "edit")).toBe("ที่นั่งพอ — คนอื่น 3 + คุณ 7 = 10 ที่ เต็มพอดี");
  });

  it("bookingErrorText: SEATS_EXCEEDED เขียนเองจาก details", () => {
    const e = new ApiError(409, "SEATS_EXCEEDED", "ที่นั่งไม่พอ", d);
    expect(bookingErrorText(e, "new")).toBe(seatsExceededText(d, "new"));
  });

  it("bookingErrorText: details ไม่ครบ / error อื่น → ข้อความของ Go", () => {
    expect(bookingErrorText(new ApiError(409, "SEATS_EXCEEDED", "ที่นั่งไม่พอ", { used: 7 }), "new")).toBe("ที่นั่งไม่พอ");
    expect(bookingErrorText(new ApiError(400, "IN_PAST", "เวลาเริ่มผ่านไปแล้ว", d), "new")).toBe("เวลาเริ่มผ่านไปแล้ว");
    expect(bookingErrorText(new Error("Failed to fetch"), "edit")).toBe("Failed to fetch");
  });
});

describe("invalidateBookingQueries", () => {
  it("ล้างแคชกราฟที่นั่งทุกร้าน/ทุกวัน และรายการจองของฉัน แต่ไม่แตะอย่างอื่น", async () => {
    const qc = new QueryClient();
    const keys = [
      ["availability", 1, "2026-09-25"],
      ["availability", 2, "2026-09-26", 12],
      ["my-bookings"],
      ["restaurant", 1],
    ];
    for (const k of keys) qc.setQueryData(k, "x");
    await invalidateBookingQueries(qc);
    const stale = keys.map((k) => qc.getQueryState(k)?.isInvalidated);
    expect(stale).toEqual([true, true, true, false]);
  });
});

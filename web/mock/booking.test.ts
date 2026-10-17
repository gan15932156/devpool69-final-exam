import { beforeEach, describe, expect, it } from "vitest";
import { availability, cancelBooking, createBooking, updateBooking, type Input } from "./booking";
import { AppError, emptyStore, type Restaurant, type Store } from "./store";
import { addDays, at, clock, crossesMidnight, dateOf, formatHHMM, parseDate, parseHHMM, resolve, serviceWindow } from "./time";

// mock ต้องให้ผลเหมือน Go (api/internal/booking) — เคสชุดเดียวกับ validate_test.go / service_db_test.go
// ถ้า test ตรงนี้กับฝั่ง Go ขัดกัน แปลว่า mock กับ Go เริ่มตัดสินไม่เหมือนกันแล้ว

const NOW = at("2026-09-25", 10 * 60); // 25 ก.ย. 10:00 เวลาไทย

let s: Store;
let day: Restaurant; // 11:00–22:00
let night: Restaurant; // 18:00–02:00

function shop(id: number, open: number, close: number, seats = 10): Restaurant {
  return { id, ownerId: 1, name: `ร้าน ${id}`, cuisine: "", description: "", seats, open, close, lead: 60, images: [] };
}

beforeEach(() => {
  s = emptyStore();
  day = shop(1, 660, 1320);
  night = shop(2, 1080, 120);
  s.restaurants.push(day, night);
});

const input = (start: string, end: string, partySize: unknown = 1, date = "2026-09-25"): Input => ({ date, start, end, partySize });

function code(fn: () => unknown) {
  try {
    fn();
  } catch (e) {
    return e instanceof AppError ? e.code : String(e);
  }
  return null;
}

describe("time (เหมือน booking/time.go)", () => {
  it("parseHHMM / formatHHMM", () => {
    expect(parseHHMM("18:30")).toBe(1110);
    for (const bad of ["", "1:00", "24:00", "12:60", "ab:cd", " 1:00", 1100]) expect(parseHHMM(bad)).toBeNull();
    expect(formatHHMM(1500)).toBe("01:00");
    expect(formatHHMM(-30)).toBe("23:30");
  });

  it("parseDate ไม่รับวันที่ที่ไม่มีจริง", () => {
    expect(parseDate("2026-09-25")).toBe("2026-09-25");
    for (const bad of ["2026-02-30", "2026-9-25", "25/09/2026", null]) expect(parseDate(bad)).toBeNull();
  });

  it("at / clock / dateOf คิดเป็นเวลาไทย", () => {
    expect(new Date(at("2026-09-25", 0)).toISOString()).toBe("2026-09-24T17:00:00.000Z");
    expect(clock(at("2026-09-25", 1110))).toBe("18:30");
    expect(dateOf(at("2026-09-25", 1439))).toBe("2026-09-25");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("serviceWindow / resolve ร้านข้ามเที่ยงคืน", () => {
    expect(crossesMidnight(1080, 0)).toBe(true);
    const w = serviceWindow("2026-09-25", 1080, 120);
    expect([w.from, w.to]).toEqual([at("2026-09-25", 1080), at("2026-09-26", 120)]);
    expect(resolve("2026-09-25", 60, 1080, 120)).toBe(at("2026-09-26", 60));
    expect(resolve("2026-09-25", 120, 1080, 120)).toBe(at("2026-09-26", 120));
    expect(resolve("2026-09-25", 1050, 1080, 120)).toBe(at("2026-09-25", 1050));
  });
});

describe("validate (ลำดับเดียวกับ Validate ใน Go)", () => {
  it.each([
    ["วันที่ผิดรูปแบบ", 1, { ...input("18:00", "19:00"), date: "25/09/2026" }, NOW, "VALIDATION"],
    ["เวลาผิดรูปแบบ", 1, input("6pm", "19:00"), NOW, "VALIDATION"],
    ["ไม่ลง :00/:30", 1, input("18:15", "19:00"), NOW, "INVALID_SLOT"],
    ["สิ้นสุด = เริ่ม", 1, input("18:00", "18:00"), NOW, "INVALID_RANGE"],
    ["ก่อนร้านเปิด", 1, input("10:30", "12:00"), NOW, "OUTSIDE_HOURS"],
    ["เลยเวลาปิด", 1, input("21:30", "22:30"), NOW, "OUTSIDE_HOURS"],
    // เหมือน Go: 02:30 เลยเวลาปิด → ไม่ย้ายไปวันถัดไป → อยู่ก่อนเวลาเริ่ม
    ["ข้ามเที่ยงคืน เลยเวลาปิด", 2, input("01:30", "02:30"), NOW, "INVALID_RANGE"],
    ["ข้ามเที่ยงคืน เริ่มก่อนเปิด", 2, input("17:00", "01:00"), NOW, "OUTSIDE_HOURS"],
    ["เวลาเริ่มผ่านไปแล้ว", 1, input("11:00", "12:00"), at("2026-09-25", 660), "IN_PAST"],
    ["เกิน 60 วัน", 1, input("18:00", "19:00", 1, addDays("2026-09-25", 61)), NOW, "TOO_FAR_AHEAD"],
    ["ไม่มีคน", 1, input("18:00", "19:00", 0), NOW, "VALIDATION"],
    ["จำนวนคนไม่ใช่จำนวนเต็ม", 1, input("18:00", "19:00", 1.5), NOW, "VALIDATION"],
    ["จำนวนคนเป็นข้อความ", 1, input("18:00", "19:00", "4"), NOW, "VALIDATION"],
  ])("%s → %s", (_name, shopId, inp, now, want) => {
    expect(code(() => createBooking(s, shopId as number, 9, inp as Input, now as number))).toBe(want);
  });

  it("ครบ 60 วันพอดีจองได้ · ร้านข้ามเที่ยงคืนจองหลังเที่ยงคืนได้", () => {
    expect(code(() => createBooking(s, 1, 9, input("18:00", "19:00", 1, addDays("2026-09-25", 60)), NOW))).toBeNull();
    const b = createBooking(s, 2, 9, input("23:00", "01:30", 2), NOW);
    expect([b.serviceDate, b.startAt, b.endAt]).toEqual(["2026-09-25", at("2026-09-25", 1380), at("2026-09-26", 90)]);
  });

  it("ร้านไม่มี → NOT_FOUND", () => expect(code(() => createBooking(s, 99, 9, input("18:00", "19:00"), NOW))).toBe("NOT_FOUND"));
});

describe("ที่นั่ง (เหมือน CheckSeats ใน Go)", () => {
  it("นับทีละช่อง: 7 + 7 ไม่ซ้อนกัน → เพิ่มได้อีก 3 · อีก 1 เกินที่ช่อง 12:00", () => {
    createBooking(s, 1, 9, input("12:00", "12:30", 7), NOW);
    createBooking(s, 1, 9, input("12:30", "13:00", 7), NOW);
    createBooking(s, 1, 9, input("12:00", "13:00", 3), NOW);
    try {
      createBooking(s, 1, 9, input("11:30", "13:00", 1), NOW);
      expect.unreachable();
    } catch (e) {
      expect(e).toMatchObject({ code: "SEATS_EXCEEDED", details: { slotStart: "12:00", slotEnd: "12:30", used: 10, party: 1, seats: 10 } });
    }
  });

  it("จำนวนคนมหาศาลไม่ล้นจนผ่าน", () => {
    createBooking(s, 1, 9, input("18:00", "19:00", 1), NOW);
    expect(code(() => createBooking(s, 1, 9, input("18:00", "19:00", Number.MAX_SAFE_INTEGER), NOW))).toBe("SEATS_EXCEEDED");
  });

  it("แก้ไข: ร้าน 10 ที่ A 7 · B 3 → A แก้เป็น 8 ✕ · 5 ✓", () => {
    const a = createBooking(s, 1, 1, input("18:00", "19:00", 7), NOW);
    createBooking(s, 1, 2, input("18:00", "19:00", 3), NOW);
    expect(code(() => updateBooking(s, a.id, 1, input("18:00", "19:00", 8), NOW))).toBe("SEATS_EXCEEDED");
    expect(updateBooking(s, a.id, 1, input("18:30", "20:00", 5), NOW)).toMatchObject({ partySize: 5, startAt: at("2026-09-25", 1110) });
  });

  it("สิทธิ์ · เส้นตาย · ยกเลิกซ้ำ", () => {
    const b = createBooking(s, 1, 1, input("18:00", "19:00", 2), NOW); // ยกเลิกได้ถึง 17:00
    expect(code(() => cancelBooking(s, b.id, 2, NOW))).toBe("FORBIDDEN");
    expect(code(() => cancelBooking(s, 99, 1, NOW))).toBe("NOT_FOUND");
    expect(code(() => cancelBooking(s, b.id, 1, at("2026-09-25", 17 * 60)))).toBeNull();
    expect(code(() => cancelBooking(s, b.id, 1, NOW))).toBe("BOOKING_CANCELLED");
    expect(code(() => updateBooking(s, b.id, 1, input("18:00", "19:00"), NOW))).toBe("BOOKING_CANCELLED");

    const c = createBooking(s, 1, 1, input("20:00", "21:00", 2), NOW);
    expect(code(() => cancelBooking(s, c.id, 1, at("2026-09-25", 19 * 60) + 1000))).toBe("CANCEL_WINDOW_PASSED");
  });

  it("ยกเลิกแล้วคืนที่นั่ง", () => {
    const b = createBooking(s, 1, 1, input("18:00", "19:00", 10), NOW);
    cancelBooking(s, b.id, 1, NOW);
    expect(code(() => createBooking(s, 1, 2, input("18:00", "19:00", 10), NOW))).toBeNull();
  });
});

describe("availability (เหมือน Availability ใน Go)", () => {
  it("ช่องละ 30 นาที · นับเฉพาะที่ยืนยัน · บอกช่องที่ผ่านไปแล้ว · exclude", () => {
    const b = createBooking(s, 1, 1, input("12:00", "13:00", 4), NOW);
    createBooking(s, 1, 1, input("12:30", "13:30", 2), NOW);
    cancelBooking(s, createBooking(s, 1, 1, input("20:00", "21:00", 5), NOW).id, 1, NOW);

    const slots = availability(s, day, "2026-09-25", 0, at("2026-09-25", 735)); // 12:15
    expect(slots).toHaveLength(22);
    const by = Object.fromEntries(slots.map((x) => [x.start, x]));
    expect(by["11:30"]).toEqual({ start: "11:30", used: 0, past: true });
    expect(by["12:00"]).toEqual({ start: "12:00", used: 4, past: false });
    expect(by["12:30"].used).toBe(6);
    expect(by["13:00"].used).toBe(2);
    expect(by["20:00"].used).toBe(0);

    expect(availability(s, day, "2026-09-25", b.id, NOW).find((x) => x.start === "12:30")?.used).toBe(2);
  });

  it("ร้านข้ามเที่ยงคืน: 16 ช่อง 18:00–01:30 · การจองหลังเที่ยงคืนอยู่ในรอบของวันก่อน", () => {
    createBooking(s, 2, 1, input("00:30", "01:30", 3), NOW);
    const slots = availability(s, night, "2026-09-25", 0, NOW);
    expect(slots.map((x) => x.start)).toHaveLength(16);
    expect([slots[0].start, slots.at(-1)?.start, slots[13]]).toEqual(["18:00", "01:30", { start: "00:30", used: 3, past: false }]);
    expect(availability(s, night, "2026-09-26", 0, NOW).every((x) => x.used === 0)).toBe(true);
  });
});

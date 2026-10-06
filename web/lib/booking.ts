// คำนวณฝั่งหน้าเว็บสำหรับใบจอง — เป็นแค่ตัวช่วย UX ให้เห็นผลก่อนกดจอง
// ตัวตัดสินจริงคือ Go (api/internal/booking) · ถ้า Go ตอบ error ต้องแสดงตามที่ Go บอกเสมอ
import type { QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ApiError } from "./api";
import { toHHMM, toMinutes } from "./format";

export type SlotUsage = { start: string; used: number; past: boolean };
export type Availability = { date: string; seats: number; slots: SlotUsage[] };

// ---------- เวลาในรอบของวัน ----------
// ใช้ "นาทีนับจากเที่ยงคืนของวันที่จอง" ซึ่งเกิน 1440 ได้ เช่น ร้าน 18:00–02:00 → 1080 ถึง 1560

export function serviceRange(openTime: string, closeTime: string) {
  const open = toMinutes(openTime);
  let close = toMinutes(closeTime);
  if (close <= open) close += 1440; // ปิดข้ามเที่ยงคืน
  return { open, close };
}

// ตัวเลือกเวลาทุก 30 นาทีจาก from ถึง to (รวมปลาย) → [{ minutes: 1530, label: "01:30" }]
export function timeOptions(from: number, to: number) {
  const out: { minutes: number; label: string }[] = [];
  for (let m = from; m <= to; m += 30) out.push({ minutes: m, label: toHHMM(m) });
  return out;
}

// วันที่ (YYYY-MM-DD) + นาทีในรอบ → Date เวลาเครื่อง (Date จัดการนาทีเกินวันให้เอง)
export function atMinutes(date: string, minutes: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 0, minutes);
}

// ---------- วันที่ ----------
// ใช้ชื่อย่อแบบกำหนดเอง ไม่พึ่ง toLocaleDateString เพราะแต่ละเบราว์เซอร์ย่อไม่เหมือนกัน ("ศ." / "ศุกร์")
const DOW = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// วันนี้ + อีก n-1 วัน (ใบจองแสดง 5 วัน) · backend รับจองล่วงหน้าได้ไม่เกิน 60 วัน (booking.MaxDaysAhead)
export function nextDays(n: number, from = new Date()) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    return {
      iso: isoDate(d),
      dow: DOW[d.getDay()], // "ศ."
      day: d.getDate(),
      sub: i === 0 ? "วันนี้" : MONTHS[d.getMonth()], // "ก.ย."
    };
  });
}

// ส่วนประกอบวันที่สำหรับต้นขั้วการ์ด: { dow: "ศ.", day: 25, mon: "ก.ย. 69", isToday }
export function dateParts(iso: string) {
  const d = atMinutes(iso, 0);
  return {
    dow: DOW[d.getDay()],
    day: d.getDate(),
    mon: `${MONTHS[d.getMonth()]} ${String(d.getFullYear() + 543).slice(2)}`,
    isToday: iso === isoDate(new Date()),
  };
}

// "2026-09-26" → "ส. 26 ก.ย. 2569" (ปี พ.ศ. = ค.ศ. + 543)
export function thaiDate(iso: string, withDow = true) {
  const d = atMinutes(iso, 0);
  const text = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
  return withDow ? `${DOW[d.getDay()]} ${text}` : text;
}

// ---------- ตรวจที่นั่ง (ตรรกะเดียวกับ CheckSeats ใน Go และ renderVals() ในดีไซน์) ----------

export type SeatCheck = {
  seats: number; // ที่นั่งของร้านตาม availability — ตัวเดียวกับที่ใช้ตัดสินว่าเกิน
  firstOver: { start: number; used: number } | null; // ช่องแรกที่เกิน
  peak: number; // ช่องที่คนจองมากสุดในช่วงที่ขอ
  inRange: (slotMinutes: number) => boolean;
  over: (slotMinutes: number) => boolean;
};

export function checkSeats(av: Availability, open: number, party: number, start: number, end: number): SeatCheck {
  let firstOver: SeatCheck["firstOver"] = null;
  let peak = 0;
  const overSet = new Set<number>();
  av.slots.forEach((s, i) => {
    const t = open + i * 30;
    if (t >= start && t < end) {
      peak = Math.max(peak, s.used);
      if (s.used + party > av.seats) {
        overSet.add(t);
        if (!firstOver) firstOver = { start: t, used: s.used };
      }
    }
  });
  return {
    seats: av.seats,
    firstOver,
    peak,
    inRange: (t) => t >= start && t < end,
    over: (t) => overSet.has(t),
  };
}

// details ของ SEATS_EXCEEDED ที่ Go ส่งมา (SeatsExceededDetails)
const seatsExceededSchema = z.object({ slotStart: z.string(), slotEnd: z.string(), used: z.number(), party: z.number(), seats: z.number() });
type SeatsExceeded = z.infer<typeof seatsExceededSchema>;

// จองใหม่: party = จำนวนที่เพิ่มเข้าไป · แก้ไข: party = จำนวนคนทั้งหมดของการจองนี้ และ used ไม่นับการจองนี้
export type BookingMode = "new" | "edit";

// ข้อความที่นั่งเกิน — ที่เดียวที่เขียนข้อความนี้ ทั้งผลตรวจหน้าเว็บและตอน Go ตอบ 409
// ดีไซน์เขียน "จองแล้ว 7 + คุณ 4 = 11 เกิน 10 ที่" ซึ่งอ่านแล้วสับสนว่า 10 คือที่เหลือ
// เลยบอกความจุร้านก่อน แล้วปิดด้วยจำนวนคนที่เกินจริง:
//   new:  "ที่นั่งไม่พอ: ช่วง 12:00–12:30 ร้านรับได้ 10 ที่ จองไปแล้ว 7 + คุณจองเพิ่ม 4 = 11 คน เกินไป 1 คน"
//   edit: "ที่นั่งไม่พอ: ช่วง 12:00–12:30 ร้านรับได้ 10 ที่ คนอื่นจองไปแล้ว 3 + คุณขอ 8 = 11 คน เกินไป 1 คน"
export function seatsExceededText(d: SeatsExceeded, mode: BookingMode) {
  const total = d.used + d.party;
  const parts = mode === "edit" ? `คนอื่นจองไปแล้ว ${d.used} + คุณขอ ${d.party}` : `จองไปแล้ว ${d.used} + คุณจองเพิ่ม ${d.party}`;
  return `ที่นั่งไม่พอ: ช่วง ${d.slotStart}–${d.slotEnd} ร้านรับได้ ${d.seats} ที่ ${parts} = ${total} คน เกินไป ${total - d.seats} คน`;
}

export function seatText(check: SeatCheck, party: number, mode: BookingMode) {
  const { seats, peak } = check;
  if (check.firstOver) {
    const t = check.firstOver.start;
    return seatsExceededText({ slotStart: toHHMM(t), slotEnd: toHHMM(t + 30), used: check.firstOver.used, party, seats }, mode);
  }
  const left = seats - peak - party; // ไม่มีช่องเกิน → ≥ 0
  if (mode === "edit") {
    return `ที่นั่งพอ — คนอื่น ${peak} + คุณ ${party} = ${peak + party} ที่${left ? ` เหลือว่าง ${left} ที่` : " เต็มพอดี"}`;
  }
  return left ? `ที่นั่งพอ — ช่วงที่แน่นที่สุดยังเหลือ ${left} ที่` : `ที่นั่งพอดี — ช่วงที่แน่นที่สุดจะเต็ม ${seats}/${seats}`;
}

// error จากการจอง/แก้ไข → ข้อความที่แสดง · SEATS_EXCEEDED เขียนเองจาก details (ถ้า details ไม่ครบใช้ข้อความของ Go) · อื่น ๆ แสดงตามที่ Go บอก
export function bookingErrorText(e: Error, mode: BookingMode) {
  const d = e instanceof ApiError && e.code === "SEATS_EXCEEDED" ? seatsExceededSchema.safeParse(e.details) : null;
  return d?.success ? seatsExceededText(d.data, mode) : e.message;
}

// การจองเปลี่ยน (จอง/แก้/ยกเลิก) → กราฟที่นั่งและรายการจองของฉันต้องโหลดใหม่
export function invalidateBookingQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["availability"] }),
    queryClient.invalidateQueries({ queryKey: ["my-bookings"] }),
  ]);
}

// คำนวณฝั่งหน้าเว็บสำหรับใบจอง — เป็นแค่ตัวช่วย UX ให้เห็นผลก่อนกดจอง
// ตัวตัดสินจริงคือ Go (api/internal/booking) · ถ้า Go ตอบ error ต้องแสดงตามที่ Go บอกเสมอ
import type { QueryClient } from "@tanstack/react-query";
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

// วันนี้ + อีก n-1 วัน (ใบจองแสดง 5 วัน) · backend ไม่จำกัดว่าจองล่วงหน้าได้ไกลแค่ไหน
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
    firstOver,
    peak,
    inRange: (t) => t >= start && t < end,
    over: (t) => overSet.has(t),
  };
}

// details ของ SEATS_EXCEEDED ที่ Go ส่งมา (SeatsExceededDetails)
type SeatsExceeded = { slotStart: string; slotEnd: string; used: number; party: number; seats: number };

// ข้อความเดียวกับดีไซน์: "ที่นั่งไม่พอ: ช่วง 12:00–12:30 จองแล้ว 7 + คุณ 4 = 11 เกิน 10 ที่"
export function seatsExceededText(d: SeatsExceeded) {
  return `ที่นั่งไม่พอ: ช่วง ${d.slotStart}–${d.slotEnd} จองแล้ว ${d.used} + คุณ ${d.party} = ${d.used + d.party} เกิน ${d.seats} ที่`;
}

export function seatText(check: SeatCheck, party: number, seats: number) {
  if (check.firstOver) {
    const t = check.firstOver.start;
    return seatsExceededText({ slotStart: toHHMM(t), slotEnd: toHHMM(t + 30), used: check.firstOver.used, party, seats });
  }
  const left = seats - check.peak - party;
  return left === 0
    ? `ที่นั่งพอดี — ช่วงที่แน่นที่สุดจะเต็ม ${seats}/${seats}`
    : `ที่นั่งพอ — ช่วงที่แน่นที่สุดยังเหลือ ${left} ที่`;
}

// error จากการจอง/แก้ไข → ข้อความที่แสดง · SEATS_EXCEEDED เขียนเองจาก details · อื่น ๆ แสดงตามที่ Go บอก
export function bookingErrorText(e: Error) {
  return e instanceof ApiError && e.code === "SEATS_EXCEEDED" ? seatsExceededText(e.details as SeatsExceeded) : e.message;
}

// การจองเปลี่ยน (จอง/แก้/ยกเลิก) → กราฟที่นั่งและรายการจองของฉันต้องโหลดใหม่
export function invalidateBookingQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["availability"] }),
    queryClient.invalidateQueries({ queryKey: ["my-bookings"] }),
  ]);
}

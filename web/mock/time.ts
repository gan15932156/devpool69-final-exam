// เวลาแบบเดียวกับ api/internal/booking/time.go — ทุกอย่างคิดเป็นเวลาไทย (UTC+7 ไม่มี daylight saving)
// เวลาจริงเก็บเป็น ms (epoch) · วันที่เป็นสตริง "2026-09-25" · เวลาในวันเป็นนาทีนับจากเที่ยงคืน

const BKK = 7 * 60 * 60 * 1000;
const MIN = 60 * 1000;

const pad = (n: number) => String(n).padStart(2, "0");

// "18:30" → 1110 · ผิดรูปแบบ → null (ต้องเป็นตัวเลข 2 หลัก : 2 หลัก)
export function parseHHMM(s: unknown): number | null {
  if (typeof s !== "string" || !/^\d\d:\d\d$/.test(s)) return null;
  const h = Number(s.slice(0, 2));
  const m = Number(s.slice(3));
  return h > 23 || m > 59 ? null : h * 60 + m;
}

// 1110 → "18:30" (เกิน 24 ชม. วนกลับ)
export function formatHHMM(minutes: number) {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export const onHalfHour = (minutes: number) => minutes % 30 === 0;
export const crossesMidnight = (open: number, close: number) => close <= open;

// "2026-09-25" ที่ถูกต้องจริง (ไม่รับ 2026-02-30)
export function parseDate(s: unknown): string | null {
  if (typeof s !== "string" || !/^\d{4}-\d\d-\d\d$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? s : null;
}

export function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// วันที่ + นาทีนับจากเที่ยงคืน (เวลาไทย) → ms
export function at(date: string, minutes: number) {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) - BKK + minutes * MIN;
}

// ms → "HH:MM" / "YYYY-MM-DD" เวลาไทย
export function clock(ms: number) {
  const t = new Date(ms + BKK);
  return `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}
export function dateOf(ms: number) {
  return new Date(ms + BKK).toISOString().slice(0, 10);
}

// ช่วงเปิดร้านของ "รอบ" วันที่ date · ร้าน 18:00–02:00 รอบวันที่ 25 = 25 18:00 ถึง 26 02:00
export function serviceWindow(date: string, open: number, close: number) {
  return { from: at(date, open), to: at(crossesMidnight(open, close) ? addDays(date, 1) : date, close) };
}

// เวลาบนหน้าปัดของรอบวันที่ date → เวลาจริง (ร้านข้ามเที่ยงคืน + ช่วงหลังเที่ยงคืน = วันถัดไป)
export function resolve(date: string, minutes: number, open: number, close: number) {
  return crossesMidnight(open, close) && minutes <= close ? at(addDays(date, 1), minutes) : at(date, minutes);
}

export { MIN };

// แปลงค่าต่าง ๆ เป็นข้อความภาษาไทยสำหรับแสดงผล

// 30 → "30 นาที" · 60 → "1 ชั่วโมง" · 90 → "1 ชม. 30 นาที"
export function durationText(minutes: number) {
  if (minutes < 60) return `${minutes} นาที`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} ชม. ${m} นาที` : `${h} ชั่วโมง`;
}

// "18:30" → 1110
export function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// 1110 → "18:30" · เกิน 24 ชม. หรือติดลบจะวนกลับ (1500 → "01:00", -30 → "23:30")
export function toHHMM(minutes: number) {
  const v = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
}

// รายการเวลาทุก 30 นาทีของวัน: ["00:00", "00:30", ..., "23:30"]
export const HALF_HOURS = Array.from({ length: 48 }, (_, i) => toHHMM(i * 30));

export function hoursText(openTime: string, closeTime: string) {
  return `${openTime}–${closeTime}`;
}

// 4.8 → "4.8" · null → "–"
export function ratingText(avg: number | null) {
  return avg === null ? "–" : avg.toFixed(1);
}

export function reviewCountText(count: number) {
  return `${count.toLocaleString("th-TH")} รีวิว`;
}

// ตัวอักษรแรกของชื่อ ข้ามสระหน้า (เ แ โ ใ ไ) → "เชฟนิด" ได้ "ช"
export function initialOf(name: string) {
  return [...name].find((ch) => !"เแโใไ".includes(ch)) ?? "?";
}

// กติกาการจองแบบเดียวกับ api/internal/booking (service.go + validate.go) — แก้ที่ Go แล้วต้องแก้ที่นี่ด้วย
import { AppError, forbidden, notFound, validation, nextId, type Booking, type Restaurant, type Store } from "./store";
import { addDays, clock, dateOf, formatHHMM, MIN, onHalfHour, parseDate, parseHHMM, resolve, serviceWindow } from "./time";

const SLOT = 30 * MIN;
const MAX_DAYS_AHEAD = 60; // booking.MaxDaysAhead

export const errSeatsExceeded = new AppError(409, "SEATS_EXCEEDED", "ที่นั่งไม่พอ");
const errWindowPassed = new AppError(409, "CANCEL_WINDOW_PASSED", "เลยเวลาที่ร้านให้แก้ไขหรือยกเลิกแล้ว");
const errBookingCancelled = new AppError(409, "BOOKING_CANCELLED", "การจองนี้ถูกยกเลิกไปแล้ว");
const errInvalidSlot = new AppError(400, "INVALID_SLOT", "เวลาต้องลงที่ :00 หรือ :30");
const errInvalidRange = new AppError(400, "INVALID_RANGE", "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม");
const errOutsideHours = new AppError(400, "OUTSIDE_HOURS", "อยู่นอกเวลาเปิดร้าน");
const errInPast = new AppError(400, "IN_PAST", "เวลาเริ่มผ่านไปแล้ว");
const errTooFarAhead = new AppError(400, "TOO_FAR_AHEAD", `จองล่วงหน้าได้ไม่เกิน ${MAX_DAYS_AHEAD} วัน`);

export type Input = { date?: unknown; start?: unknown; end?: unknown; partySize?: unknown };
type Slot = { serviceDate: string; startAt: number; endAt: number };

export function parseDateParam(s: unknown) {
  const d = parseDate(s);
  if (!d) throw validation({ date: "รูปแบบวันที่ต้องเป็น YYYY-MM-DD" });
  return d;
}

export const cancelDeadline = (b: Booking, r: Restaurant) => b.startAt - r.lead * MIN;

// แก้ไข/ยกเลิกได้ไหม — ใช้ทั้งตอนตัดสินจริงและตอนบอกหน้าเว็บ (canCancel)
export function modifyError(b: Booking, r: Restaurant, now: number) {
  if (b.status === "cancelled") return errBookingCancelled;
  if (now > cancelDeadline(b, r)) return errWindowPassed;
  return null;
}

// ตรวจตามลำดับเดียวกับ Validate ใน Go (เจอข้อแรกที่ผิดก็หยุด)
function validate(r: Restaurant, input: Input, now: number): Slot {
  const date = parseDateParam(input.date);
  const start = parseHHMM(input.start);
  const end = parseHHMM(input.end);
  if (start === null || end === null) throw validation({ start: "รูปแบบเวลาต้องเป็น HH:MM" });
  if (!onHalfHour(start) || !onHalfHour(end)) throw errInvalidSlot;

  const startAt = resolve(date, start, r.open, r.close);
  const endAt = resolve(date, end, r.open, r.close);
  if (endAt <= startAt) throw errInvalidRange;

  const w = serviceWindow(date, r.open, r.close);
  if (startAt < w.from || endAt > w.to) {
    throw errOutsideHours.withDetails({ open: formatHHMM(r.open), close: formatHHMM(r.close) });
  }
  if (startAt <= now) throw errInPast;
  if (date > addDays(dateOf(now), MAX_DAYS_AHEAD)) throw errTooFarAhead.withDetails({ maxDays: MAX_DAYS_AHEAD });

  const party = input.partySize;
  if (typeof party !== "number" || !Number.isInteger(party) || party < 1) {
    throw validation({ partySize: "ต้องมีอย่างน้อย 1 คน" });
  }
  return { serviceDate: date, startAt, endAt };
}

function overlapping(s: Store, restaurantId: number, from: number, to: number, excludeId = 0) {
  return s.bookings.filter(
    (b) => b.restaurantId === restaurantId && b.status === "confirmed" && b.startAt < to && b.endAt > from && b.id !== excludeId,
  );
}

const usedIn = (bookings: Booking[], from: number, to: number) =>
  bookings.reduce((sum, b) => (b.startAt < to && b.endAt > from ? sum + b.partySize : sum), 0);

// วนทีละช่อง 30 นาที · ทุกช่องต้อง จองแล้ว + คนที่ขอ ≤ ที่นั่ง
function checkSeats(s: Store, r: Restaurant, slot: Slot, party: number, excludeId = 0) {
  const bookings = overlapping(s, r.id, slot.startAt, slot.endAt, excludeId);
  for (let t = slot.startAt; t < slot.endAt; t += SLOT) {
    const used = usedIn(bookings, t, t + SLOT);
    if (party > r.seats - used) {
      throw errSeatsExceeded.withDetails({ slotStart: clock(t), slotEnd: clock(t + SLOT), used, party, seats: r.seats });
    }
  }
}

function findRestaurant(s: Store, id: number) {
  const r = s.restaurants.find((x) => x.id === id);
  if (!r) throw notFound("ร้าน");
  return r;
}

export function createBooking(s: Store, restaurantId: number, userId: number, input: Input, now: number) {
  const r = findRestaurant(s, restaurantId);
  const slot = validate(r, input, now);
  checkSeats(s, r, slot, input.partySize as number);
  const b: Booking = {
    id: nextId(s, "booking"),
    restaurantId: r.id,
    userId,
    partySize: input.partySize as number,
    ...slot,
    status: "confirmed",
  };
  s.bookings.push(b);
  return b;
}

function loadOwnBooking(s: Store, bookingId: number, userId: number, now: number) {
  const b = s.bookings.find((x) => x.id === bookingId);
  if (!b) throw notFound("การจอง");
  if (b.userId !== userId) throw forbidden();
  const r = findRestaurant(s, b.restaurantId);
  const err = modifyError(b, r, now);
  if (err) throw err;
  return { b, r };
}

// แก้ไข = กติกาเดียวกับจองใหม่ แต่ไม่นับที่นั่งเดิมของการจองนี้ซ้ำ
export function updateBooking(s: Store, bookingId: number, userId: number, input: Input, now: number) {
  const { b, r } = loadOwnBooking(s, bookingId, userId, now);
  const slot = validate(r, input, now);
  checkSeats(s, r, slot, input.partySize as number, b.id);
  Object.assign(b, slot, { partySize: input.partySize as number });
  return b;
}

export function cancelBooking(s: Store, bookingId: number, userId: number, now: number) {
  const { b } = loadOwnBooking(s, bookingId, userId, now);
  b.status = "cancelled";
  return b;
}

// ที่นั่งที่ถูกจองในแต่ละช่อง 30 นาทีตลอดเวลาเปิดของรอบวันที่ date
export function availability(s: Store, r: Restaurant, date: string, excludeId: number, now: number) {
  const { from, to } = serviceWindow(date, r.open, r.close);
  const bookings = overlapping(s, r.id, from, to, excludeId);
  const slots = [];
  for (let t = from; t < to; t += SLOT) {
    slots.push({ start: clock(t), used: usedIn(bookings, t, t + SLOT), past: t + SLOT <= now });
  }
  return slots;
}

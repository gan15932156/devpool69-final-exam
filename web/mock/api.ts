// mock ของ Go API (api/internal/handlers) — endpoint, รูปร่าง JSON, error code และกติกาเหมือนของจริง
// ใช้ตอน `npm run dev:mock` เพื่อทดสอบหน้าเว็บโดยไม่ต้องเปิด Go/PostgreSQL · ข้อมูลอยู่ในหน่วยความจำ
import { availability, cancelBooking, cancelDeadline, createBooking, modifyError, parseDateParam, updateBooking } from "./booking";
import { MIN_REVIEWS_FOR_RANKING, seedStore } from "./seed";
import {
  AppError,
  badBody,
  forbidden,
  nextId,
  notFound,
  unauthorized,
  validation,
  type Booking,
  type Restaurant,
  type Review,
  type Store,
} from "./store";
import { clock, crossesMidnight, dateOf, formatHHMM, onHalfHour, parseHHMM } from "./time";

// เก็บไว้บน globalThis → แก้โค้ดแล้ว hot reload ข้อมูลไม่หาย และทุก route ใช้ชุดเดียวกัน
const g = globalThis as { __toawangMock?: Store };
export const store = () => (g.__toawangMock ??= seedStore());

export const isMockEnabled = () => process.env.MOCK_API === "1";

// ---------- token: "mock.<userId>" (ไม่ใช่ JWT จริง — token ของ Go ใช้กับ mock ไม่ได้ และกลับกัน) ----------

const tokenFor = (userId: number) => `mock.${userId}`;

function userIdFrom(req: Request, s: Store) {
  const m = /^Bearer mock\.(\d+)$/.exec(req.headers.get("authorization") ?? "");
  const id = m ? Number(m[1]) : 0;
  return s.users.some((u) => u.id === id) ? id : 0;
}

// ---------- DTO (ตรงกับ struct ...DTO ใน Go และ web/lib/types.ts) ----------

function restaurantDTO(s: Store, r: Restaurant) {
  const reviews = s.reviews.filter((x) => x.restaurantId === r.id);
  const avg = reviews.length ? Math.round((reviews.reduce((sum, x) => sum + x.rating, 0) / reviews.length) * 10) / 10 : null;
  return {
    id: r.id,
    ownerId: r.ownerId,
    name: r.name,
    cuisine: r.cuisine,
    description: r.description,
    seats: r.seats,
    openTime: formatHHMM(r.open),
    closeTime: formatHHMM(r.close),
    crossesMidnight: crossesMidnight(r.open, r.close),
    cancelLeadMinutes: r.lead,
    images: r.images,
    avgRating: avg,
    reviewCount: reviews.length,
    hasEnoughReviews: reviews.length >= MIN_REVIEWS_FOR_RANKING,
  };
}

function restaurantDetailDTO(s: Store, r: Restaurant) {
  const distribution: Record<string, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const x of s.reviews) if (x.restaurantId === r.id) distribution[x.rating]++;
  return { ...restaurantDTO(s, r), distribution };
}

function bookingDTO(s: Store, b: Booking, now: number) {
  const r = s.restaurants.find((x) => x.id === b.restaurantId)!;
  const deadline = cancelDeadline(b, r);
  return {
    id: b.id,
    restaurantId: r.id,
    restaurantName: r.name,
    partySize: b.partySize,
    serviceDate: b.serviceDate,
    start: clock(b.startAt),
    end: clock(b.endAt),
    status: b.status,
    cancelDeadline: clock(deadline),
    cancelDeadlineDate: dateOf(deadline),
    cancelLeadMinutes: r.lead,
    canCancel: modifyError(b, r, now) === null,
    hasReviewed: s.reviews.some((x) => x.restaurantId === r.id && x.userId === b.userId),
  };
}

function reviewDTO(s: Store, x: Review, me: number) {
  return {
    id: x.id,
    rating: x.rating,
    comment: x.comment,
    userName: s.users.find((u) => u.id === x.userId)?.name ?? "",
    isMine: me !== 0 && x.userId === me,
    createdAt: new Date(x.createdAt).toISOString(),
    updatedAt: new Date(x.updatedAt).toISOString(),
  };
}

const userDTO = (u: { id: number; name: string; email: string; createdAt: number }) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  createdAt: new Date(u.createdAt).toISOString(),
});

// ---------- ตัวช่วย ----------

type Ctx = { req: Request; url: URL; s: Store; me: number; now: number };

const json = (data: unknown, status = 200) => Response.json(data, { status });

async function body<T>(req: Request): Promise<T> {
  try {
    const data = await req.json();
    if (data && typeof data === "object") return data as T;
  } catch {}
  throw badBody();
}

function id(raw: string) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw notFound("ข้อมูล");
  return n;
}

function requireAuth(c: Ctx) {
  if (!c.me) throw unauthorized();
  return c.me;
}

function findRestaurant(c: Ctx, rawId: string) {
  const r = c.s.restaurants.find((x) => x.id === id(rawId));
  if (!r) throw notFound("ร้าน");
  return r;
}

// โหลดร้านแล้วเช็กว่าคนที่ login เป็นเจ้าของ · ไม่ใช่ → 403
function ownedRestaurant(c: Ctx, rawId: string) {
  const me = requireAuth(c);
  const r = findRestaurant(c, rawId);
  if (r.ownerId !== me) throw forbidden();
  return r;
}

const normalizeEmail = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : "");
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const runes = (v: string) => [...v].length;

// เพดานเดียวกับ api/internal/handlers/limits.go (rate limit ไม่ได้ทำใน mock)
const MAX_NAME_LENGTH = 100;
const MAX_SEATS = 1000;
const MAX_CANCEL_LEAD_MINUTES = 7 * 24 * 60;
const MAX_ACTIVE_BOOKINGS = 30;

// ---------- ร้าน ----------

type RestaurantInput = {
  name?: unknown;
  cuisine?: unknown;
  description?: unknown;
  seats?: unknown;
  openTime?: unknown;
  closeTime?: unknown;
  cancelLeadMinutes?: unknown;
  images?: unknown;
};

// กติกาเดียวกับ restaurantInput.validate() ใน Go
function validateRestaurant(input: RestaurantInput) {
  const name = str(input.name);
  const cuisine = str(input.cuisine);
  const description = str(input.description);
  const seats = typeof input.seats === "number" ? input.seats : 0;
  const lead = typeof input.cancelLeadMinutes === "number" ? input.cancelLeadMinutes : 0;
  const images = Array.isArray(input.images) ? input.images.filter((x): x is string => typeof x === "string") : [];
  const open = parseHHMM(input.openTime);
  const close = parseHHMM(input.closeTime);
  const fields: Record<string, string> = {};

  if (!name || runes(name) > 100) fields.name = "กรุณากรอกชื่อร้าน (ไม่เกิน 100 ตัวอักษร)";
  if (runes(cuisine) > 100) fields.cuisine = "ประเภทอาหารยาวเกินไป";
  if (runes(description) > 2000) fields.description = "รายละเอียดยาวเกินไป (ไม่เกิน 2,000 ตัวอักษร)";
  if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) fields.seats = `จำนวนที่นั่งต้องอยู่ระหว่าง 1–${MAX_SEATS}`;
  if (open === null) fields.openTime = "กรุณาใส่เวลาเปิด";
  else if (!onHalfHour(open)) fields.openTime = "เวลาต้องลงที่ :00 หรือ :30";
  if (close === null) fields.closeTime = "กรุณาใส่เวลาปิด";
  else if (!onHalfHour(close)) fields.closeTime = "เวลาต้องลงที่ :00 หรือ :30";
  else if (open !== null && open === close) fields.closeTime = "เวลาเปิดและปิดต้องไม่ตรงกัน";
  if (!Number.isInteger(lead) || lead < 30 || lead > MAX_CANCEL_LEAD_MINUTES) {
    fields.cancelLeadMinutes = "ยกเลิกล่วงหน้าได้ตั้งแต่ 30 นาทีถึง 7 วัน";
  }
  if (images.length === 0 || images.length > 8) fields.images = "ต้องมีรูป 1–8 รูป";
  if (images.some((u) => !u.startsWith("/uploads/") || u.includes(".."))) fields.images = "รูปไม่ถูกต้อง กรุณาอัปโหลดใหม่";
  if (Object.keys(fields).length) throw validation(fields);

  return { name, cuisine, description, seats, open: open!, close: close!, lead, images };
}

function listRestaurants(c: Ctx) {
  const q = (c.url.searchParams.get("q") ?? "").trim().toLowerCase();
  const sort = c.url.searchParams.get("sort") ?? "rating";
  if (sort !== "rating" && sort !== "reviews") throw validation({ sort: "sort ต้องเป็น rating หรือ reviews" });

  const rows = c.s.restaurants
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q))
    .map((r) => restaurantDTO(c.s, r));
  const avg = (x: (typeof rows)[number]) => x.avgRating ?? -1; // NULLS LAST
  rows.sort((a, b) =>
    sort === "rating"
      ? // ร้านที่รีวิวถึงเกณฑ์ขึ้นก่อน → แล้วค่อยเรียงคะแนน
        Number(b.hasEnoughReviews) - Number(a.hasEnoughReviews) || avg(b) - avg(a) || b.reviewCount - a.reviewCount || a.id - b.id
      : b.reviewCount - a.reviewCount || avg(b) - avg(a) || a.id - b.id,
  );
  return json(rows);
}

async function createRestaurant(c: Ctx) {
  const me = requireAuth(c);
  const v = validateRestaurant(await body(c.req));
  const r: Restaurant = { id: nextId(c.s, "restaurant"), ownerId: me, ...v };
  c.s.restaurants.push(r);
  return json(restaurantDetailDTO(c.s, r), 201);
}

async function updateRestaurant(c: Ctx, rawId: string) {
  const r = ownedRestaurant(c, rawId);
  Object.assign(r, validateRestaurant(await body(c.req)));
  return json(restaurantDetailDTO(c.s, r));
}

function deleteRestaurant(c: Ctx, rawId: string) {
  const r = ownedRestaurant(c, rawId);
  const upcoming = c.s.bookings.filter((b) => b.restaurantId === r.id && b.status === "confirmed" && b.endAt > c.now).length;
  if (upcoming > 0) {
    throw new AppError(409, "HAS_FUTURE_BOOKINGS", "ลบไม่ได้ เพราะยังมีการจองที่ยังไม่ถึงเวลา", { count: upcoming });
  }
  c.s.restaurants = c.s.restaurants.filter((x) => x.id !== r.id);
  c.s.bookings = c.s.bookings.filter((x) => x.restaurantId !== r.id);
  c.s.reviews = c.s.reviews.filter((x) => x.restaurantId !== r.id);
  return new Response(null, { status: 204 });
}

// ---------- การจอง ----------

function getAvailability(c: Ctx, rawId: string) {
  const r = findRestaurant(c, rawId);
  const raw = c.url.searchParams.get("date");
  const date = raw ? parseDateParam(raw) : dateOf(c.now);
  // excludeBookingId ใช้ได้เฉพาะการจองของตัวเอง
  const ex = Number(c.url.searchParams.get("excludeBookingId"));
  const own = c.s.bookings.find((b) => b.id === ex && c.me !== 0 && b.userId === c.me);
  return json({ date, seats: r.seats, slots: availability(c.s, r, date, own?.id ?? 0, c.now) });
}

function myBookings(c: Ctx) {
  const me = requireAuth(c);
  const mine = c.s.bookings.filter((b) => b.userId === me).sort((a, b) => a.startAt - b.startAt);
  const dto = (b: Booking) => bookingDTO(c.s, b, c.now);
  return json({
    upcoming: mine.filter((b) => b.status === "confirmed" && b.endAt > c.now).map(dto),
    past: mine.filter((b) => b.status === "confirmed" && b.endAt <= c.now).reverse().map(dto),
    cancelled: mine.filter((b) => b.status === "cancelled").reverse().map(dto),
  });
}

function restaurantBookings(c: Ctx, rawId: string) {
  const r = ownedRestaurant(c, rawId);
  const date = parseDateParam(c.url.searchParams.get("date") ?? "");
  const rows = c.s.bookings
    .filter((b) => b.restaurantId === r.id && b.serviceDate === date)
    .sort((a, b) => a.startAt - b.startAt || a.id - b.id);
  return json(
    rows.map((b) => ({
      id: b.id,
      customerName: c.s.users.find((u) => u.id === b.userId)?.name ?? "",
      partySize: b.partySize,
      start: clock(b.startAt),
      end: clock(b.endAt),
      status: b.status,
    })),
  );
}

// ---------- รีวิว ----------

function listReviews(c: Ctx, rawId: string) {
  const r = findRestaurant(c, rawId);
  const offset = Math.max(0, Number.parseInt(c.url.searchParams.get("offset") ?? "0", 10) || 0);
  const all = c.s.reviews
    .filter((x) => x.restaurantId === r.id)
    .sort((a, b) => b.updatedAt - a.updatedAt || b.id - a.id);
  // รีวิวของตัวเองส่งมากับหน้าแรกหน้าเดียว
  const mine = c.me && offset === 0 ? all.find((x) => x.userId === c.me) : undefined;
  return json({
    total: all.length,
    items: all.slice(offset, offset + 20).map((x) => reviewDTO(c.s, x, c.me)),
    mine: mine ? reviewDTO(c.s, mine, c.me) : null,
  });
}

async function upsertMyReview(c: Ctx, rawId: string) {
  const me = requireAuth(c);
  const r = findRestaurant(c, rawId);
  if (r.ownerId === me) throw new AppError(403, "OWN_RESTAURANT", "รีวิวร้านของตัวเองไม่ได้");

  const input = await body<{ rating?: unknown; comment?: unknown }>(c.req);
  if (input.rating !== undefined && !Number.isInteger(input.rating)) throw badBody(); // 3.5 → แปลงเป็น int ไม่ได้
  const rating = (input.rating as number | undefined) ?? 0;
  const comment = str(input.comment);
  const fields: Record<string, string> = {};
  if (rating < 1 || rating > 5) fields.rating = "ให้คะแนน 1–5 ดาว";
  if (runes(comment) > 1000) fields.comment = "ข้อความยาวเกิน 1,000 ตัวอักษร";
  if (Object.keys(fields).length) throw validation(fields);

  let review = c.s.reviews.find((x) => x.restaurantId === r.id && x.userId === me);
  if (review) {
    Object.assign(review, { rating, comment, updatedAt: c.now });
  } else {
    review = { id: nextId(c.s, "review"), restaurantId: r.id, userId: me, rating, comment, createdAt: c.now, updatedAt: c.now };
    c.s.reviews.push(review);
  }
  return json(reviewDTO(c.s, review, me));
}

// ---------- บัญชี ----------

async function register(c: Ctx) {
  const input = await body<{ name?: unknown; email?: unknown; password?: unknown }>(c.req);
  const name = str(input.name);
  const email = normalizeEmail(input.email);
  const password = typeof input.password === "string" ? input.password : "";
  const fields: Record<string, string> = {};
  if (!name || runes(name) > MAX_NAME_LENGTH) fields.name = `กรุณากรอกชื่อที่แสดง (ไม่เกิน ${MAX_NAME_LENGTH} ตัวอักษร)`;
  if (!/^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+$/.test(email)) fields.email = "รูปแบบอีเมลไม่ถูกต้อง";
  if (runes(password) < 8 || !/\d/.test(password)) fields.password = "รหัสผ่านต้องมีอย่างน้อย 8 ตัวและมีตัวเลข";
  else if (new TextEncoder().encode(password).length > 72) fields.password = "รหัสผ่านยาวเกินไป";
  if (Object.keys(fields).length) throw validation(fields);
  if (c.s.users.some((u) => u.email === email)) throw new AppError(409, "EMAIL_TAKEN", "อีเมลนี้มีบัญชีอยู่แล้ว");

  const user = { id: nextId(c.s, "user"), name, email, password, createdAt: c.now };
  c.s.users.push(user);
  return json({ user: userDTO(user), accessToken: tokenFor(user.id) }, 201);
}

async function login(c: Ctx) {
  const input = await body<{ email?: unknown; password?: unknown }>(c.req);
  const user = c.s.users.find((u) => u.email === normalizeEmail(input.email));
  if (!user || user.password !== input.password) throw new AppError(401, "UNAUTHORIZED", "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
  return json({ user: userDTO(user), accessToken: tokenFor(user.id) });
}

// ---------- อัปโหลดรูป (เก็บในหน่วยความจำ · เสิร์ฟที่ /uploads/<ชื่อ>) ----------

// ดูชนิดไฟล์จาก byte แรก ๆ เหมือน http.DetectContentType ใน Go
function imageType(b: Uint8Array): [type: string, ext: string] | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return ["image/jpeg", ".jpg"];
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return ["image/png", ".png"];
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return ["image/webp", ".webp"];
  return null;
}

async function upload(c: Ctx) {
  requireAuth(c);
  const form = await c.req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw validation({ file: "กรุณาเลือกไฟล์รูป" });
  const unsupported = new AppError(400, "UNSUPPORTED_FILE", "รับเฉพาะรูป JPG, PNG, WEBP ขนาดไม่เกิน 5MB");
  if (file.size > 5 << 20) throw unsupported;
  const data = await file.arrayBuffer();
  const kind = imageType(new Uint8Array(data));
  if (!kind) throw unsupported;
  const name = `mock-${crypto.randomUUID().replaceAll("-", "")}${kind[1]}`;
  c.s.uploads.set(name, { type: kind[0], data });
  return json({ url: `/uploads/${name}` }, 201);
}

// ---------- router ----------

type Handler = (c: Ctx, ...params: string[]) => Response | Promise<Response>;

// [method, pattern] · ":" = ตัวแปรใน path · ลำดับตรงกับ api/internal/handlers/routes.go
const routes: [string, string, Handler][] = [
  ["GET", "health", () => json({ status: "ok", mock: true })],
  ["POST", "auth/register", register],
  ["POST", "auth/login", login],
  ["GET", "me", (c) => json(userDTO(c.s.users.find((u) => u.id === requireAuth(c))!))],
  ["GET", "restaurants", listRestaurants],
  ["GET", "restaurants/:", (c, i) => json(restaurantDetailDTO(c.s, findRestaurant(c, i)))],
  ["POST", "restaurants", createRestaurant],
  ["PUT", "restaurants/:", updateRestaurant],
  ["DELETE", "restaurants/:", deleteRestaurant],
  ["GET", "me/restaurants", (c) => {
    const me = requireAuth(c);
    return json(c.s.restaurants.filter((r) => r.ownerId === me).map((r) => restaurantDTO(c.s, r)));
  }],
  ["POST", "uploads", upload],
  ["GET", "restaurants/:/availability", getAvailability],
  ["POST", "restaurants/:/bookings", async (c, i) => {
    const me = requireAuth(c);
    const active = c.s.bookings.filter((b) => b.userId === me && b.status === "confirmed" && b.endAt > c.now).length;
    if (active >= MAX_ACTIVE_BOOKINGS) {
      throw new AppError(409, "BOOKING_LIMIT", `มีการจองที่ยังไม่ถึงเวลาครบ ${MAX_ACTIVE_BOOKINGS} รายการแล้ว ยกเลิกรายการเดิมก่อนจองเพิ่ม`, {
        limit: MAX_ACTIVE_BOOKINGS,
      });
    }
    const b = createBooking(c.s, findRestaurant(c, i).id, me, await body(c.req), c.now);
    return json(bookingDTO(c.s, b, c.now), 201);
  }],
  ["GET", "me/bookings", myBookings],
  ["PUT", "bookings/:", async (c, i) => {
    const b = updateBooking(c.s, id(i), requireAuth(c), await body(c.req), c.now);
    return json(bookingDTO(c.s, b, c.now));
  }],
  ["POST", "bookings/:/cancel", (c, i) => json(bookingDTO(c.s, cancelBooking(c.s, id(i), requireAuth(c), c.now), c.now))],
  ["GET", "restaurants/:/reviews", listReviews],
  ["PUT", "restaurants/:/reviews/me", upsertMyReview],
  ["GET", "restaurants/:/bookings", restaurantBookings],
];

function match(pattern: string, path: string[]) {
  const parts = pattern.split("/");
  if (parts.length !== path.length) return null;
  const params: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === ":") params.push(path[i]);
    else if (parts[i] !== path[i]) return null;
  }
  return params;
}

// path = ส่วนหลัง /api/v1/ เช่น ["restaurants", "3", "availability"]
export async function handleApi(req: Request, path: string[]) {
  const s = store();
  const c: Ctx = { req, url: new URL(req.url), s, me: userIdFrom(req, s), now: Date.now() };
  try {
    let pathMatched = false;
    for (const [method, pattern, handler] of routes) {
      const params = match(pattern, path);
      if (!params) continue;
      pathMatched = true;
      if (method === req.method) return await handler(c, ...params);
    }
    throw pathMatched
      ? new AppError(405, "METHOD_NOT_ALLOWED", "Method Not Allowed")
      : new AppError(404, "NOT_FOUND", `Cannot ${req.method} /api/v1/${path.join("/")}`);
  } catch (e) {
    if (e instanceof AppError) {
      return json({ error: { code: e.code, message: e.message, details: e.details } }, e.status);
    }
    console.error("[mock api]", e);
    return json({ error: { code: "INTERNAL", message: "เกิดข้อผิดพลาดในระบบ", details: null } }, 500);
  }
}

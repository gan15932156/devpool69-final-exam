import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleApi } from "./api";
import { seedStore, TEST_PASSWORD } from "./seed";
import { emptyStore } from "./store";
import { addDays, at, dateOf } from "./time";

// mock API ทั้งชุด (ที่ `npm run dev:mock` ใช้) ผ่าน handleApi ตัวเดียวกับ route จริง

const NOW = at("2026-09-25", 10 * 60);
const g = globalThis as { __toawangMock?: unknown };

async function call(method: string, path: string, opts: { token?: string; json?: unknown } = {}) {
  const headers = new Headers();
  if (opts.token) headers.set("authorization", `Bearer ${opts.token}`);
  if (opts.json !== undefined) headers.set("content-type", "application/json");
  const req = new Request(`http://web.test/mock/api/v1/${path}`, {
    method,
    headers,
    body: opts.json === undefined ? undefined : JSON.stringify(opts.json),
  });
  const [p] = path.split("?");
  const res = await handleApi(req, p.split("/"));
  const data = res.status === 204 ? null : await res.json();
  return { status: res.status, data, code: data?.error?.code as string | undefined };
}

async function register(name: string, email: string) {
  const r = await call("POST", "auth/register", { json: { name, email, password: "password1" } });
  expect(r.status).toBe(201);
  return r.data.accessToken as string;
}

const shopInput = { name: "ร้าน", cuisine: "", description: "", seats: 10, openTime: "11:00", closeTime: "22:00", cancelLeadMinutes: 60, images: ["/uploads/a.jpg"] };

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  g.__toawangMock = emptyStore();
});
afterEach(() => {
  vi.useRealTimers();
  delete g.__toawangMock;
});

describe("routing", () => {
  it("404 / 405 / 401 รูปแบบเดียวกับ Go", async () => {
    expect((await call("GET", "nope")).code).toBe("NOT_FOUND");
    expect((await call("PATCH", "restaurants")).code).toBe("METHOD_NOT_ALLOWED");
    expect(await call("GET", "me")).toMatchObject({ status: 401, code: "UNAUTHORIZED" });
    expect((await call("GET", "me", { token: "not-mock" })).status).toBe(401);
    expect((await call("GET", "restaurants/abc")).code).toBe("NOT_FOUND");
  });

  it("JSON เสีย → VALIDATION", async () => {
    const req = new Request("http://web.test/x", { method: "POST", body: "{", headers: { "content-type": "application/json" } });
    const res = await handleApi(req, ["auth", "login"]);
    expect(res.status).toBe(400);
  });
});

describe("บัญชี", () => {
  it("สมัคร (อีเมลไม่สนตัวพิมพ์) → login → me", async () => {
    const token = await register("ต้น", " Ton@Example.com ");
    expect((await call("POST", "auth/register", { json: { name: "x", email: "TON@example.com", password: "password1" } })).code).toBe("EMAIL_TAKEN");
    expect((await call("POST", "auth/login", { json: { email: "ton@example.com", password: "wrong" } })).status).toBe(401);
    const login = await call("POST", "auth/login", { json: { email: "TON@example.com", password: "password1" } });
    expect(login.data.accessToken).toBe(token);
    expect((await call("GET", "me", { token })).data).toMatchObject({ name: "ต้น", email: "ton@example.com" });
    expect((await call("POST", "auth/logout", { token })).status).toBe(204);
  });

  it("validation เหมือน Go", async () => {
    const r = await call("POST", "auth/register", { json: { name: "", email: "a <a@b.co>", password: "short" } });
    expect(r.code).toBe("VALIDATION");
    expect(Object.keys(r.data.error.details).sort()).toEqual(["email", "name", "password"]);
  });
});

describe("ร้าน + การจอง", () => {
  it("flow ครบ: สร้างร้าน → จอง → กราฟ → แก้ → ยกเลิก → ลบร้าน", async () => {
    const owner = await register("เจ้าของ", "o@example.com");
    const me = await register("ลูกค้า", "c@example.com");
    const other = await register("คนอื่น", "x@example.com");

    const shop = await call("POST", "restaurants", { token: owner, json: shopInput });
    expect(shop.status).toBe(201);
    expect(shop.data).toMatchObject({ openTime: "11:00", closeTime: "22:00", crossesMidnight: false, avgRating: null, reviewCount: 0 });
    const id = shop.data.id;
    expect((await call("PUT", `restaurants/${id}`, { token: other, json: shopInput })).code).toBe("FORBIDDEN");

    const date = dateOf(NOW);
    const b = await call("POST", `restaurants/${id}/bookings`, { token: me, json: { date, start: "18:00", end: "19:00", partySize: 6 } });
    expect(b.status).toBe(201);
    expect(b.data).toMatchObject({ start: "18:00", end: "19:00", cancelDeadline: "17:00", canCancel: true, restaurantName: "ร้าน" });

    const full = await call("POST", `restaurants/${id}/bookings`, { token: other, json: { date, start: "18:30", end: "19:30", partySize: 5 } });
    expect(full.code).toBe("SEATS_EXCEEDED");

    const av = await call("GET", `restaurants/${id}/availability?date=${date}`);
    expect(av.data.slots.find((x: { start: string }) => x.start === "18:00").used).toBe(6);

    expect((await call("DELETE", `restaurants/${id}`, { token: owner })).code).toBe("HAS_FUTURE_BOOKINGS");

    const edited = await call("PUT", `bookings/${b.data.id}`, { token: me, json: { date, start: "19:00", end: "20:00", partySize: 10 } });
    expect(edited.data).toMatchObject({ start: "19:00", partySize: 10 });

    const mine = await call("GET", "me/bookings", { token: me });
    expect([mine.data.upcoming.length, mine.data.past.length, mine.data.cancelled.length]).toEqual([1, 0, 0]);

    const cancelled = await call("POST", `bookings/${b.data.id}/cancel`, { token: me });
    expect(cancelled.data).toMatchObject({ status: "cancelled", canCancel: false });
    expect((await call("DELETE", `restaurants/${id}`, { token: owner })).status).toBe(204);
  });

  it("เพดาน 30 การจองต่อคน", async () => {
    const owner = await register("เจ้าของ", "o@example.com");
    const me = await register("ลูกค้า", "c@example.com");
    const { data: shop } = await call("POST", "restaurants", { token: owner, json: { ...shopInput, seats: 1000 } });
    const json = { date: addDays(dateOf(NOW), 1), start: "12:00", end: "13:00", partySize: 1 };
    for (let i = 0; i < 30; i++) expect((await call("POST", `restaurants/${shop.id}/bookings`, { token: me, json })).status).toBe(201);
    expect((await call("POST", `restaurants/${shop.id}/bookings`, { token: me, json })).code).toBe("BOOKING_LIMIT");
  });

  it("รีวิว: รีวิวร้านตัวเองไม่ได้ · ส่งซ้ำ = แก้รีวิวเดิม · ค่าเฉลี่ยตาม", async () => {
    const owner = await register("เจ้าของ", "o@example.com");
    const me = await register("ลูกค้า", "c@example.com");
    const { data: shop } = await call("POST", "restaurants", { token: owner, json: shopInput });
    expect((await call("PUT", `restaurants/${shop.id}/reviews/me`, { token: owner, json: { rating: 5 } })).code).toBe("OWN_RESTAURANT");
    expect((await call("PUT", `restaurants/${shop.id}/reviews/me`, { token: me, json: { rating: 6 } })).code).toBe("VALIDATION");
    const first = await call("PUT", `restaurants/${shop.id}/reviews/me`, { token: me, json: { rating: 3 } });
    const second = await call("PUT", `restaurants/${shop.id}/reviews/me`, { token: me, json: { rating: 5, comment: "ดี" } });
    expect(second.data.id).toBe(first.data.id);
    const detail = await call("GET", `restaurants/${shop.id}`);
    expect(detail.data).toMatchObject({ avgRating: 5, reviewCount: 1, distribution: { 5: 1, 3: 0 } });
  });
});

describe("seedStore (ข้อมูลเดโมของ dev:mock)", () => {
  it("บัญชีเดโม login ได้ และเคสครัวริมคลองพรุ่งนี้ 12:00–13:00 เต็มพอดี 7 + 3", async () => {
    g.__toawangMock = seedStore(NOW);
    const login = await call("POST", "auth/login", { json: { email: "usr2@email.com", password: TEST_PASSWORD } });
    expect(login.status).toBe(200);

    const list = await call("GET", "restaurants");
    const krua = list.data.find((r: { name: string }) => r.name === "ครัวริมคลอง");
    const av = await call("GET", `restaurants/${krua.id}/availability?date=${addDays(dateOf(NOW), 1)}`);
    const used = av.data.slots.filter((x: { start: string }) => x.start === "12:00" || x.start === "12:30").map((x: { used: number }) => x.used);
    expect([krua.seats, ...used]).toEqual([10, 10, 10]);
  });

  it("ไม่มีช่องไหนจองเกินที่นั่ง", async () => {
    g.__toawangMock = seedStore(NOW);
    const { data: shops } = await call("GET", "restaurants");
    for (const r of shops) {
      for (let d = -31; d <= 7; d++) {
        const av = await call("GET", `restaurants/${r.id}/availability?date=${addDays(dateOf(NOW), d)}`);
        for (const x of av.data.slots) expect(x.used, `${r.name} ${d} ${x.start}`).toBeLessThanOrEqual(r.seats);
      }
    }
  });
});

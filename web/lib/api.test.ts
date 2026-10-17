import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, request } from "./api";

function mockFetch(res: Response) {
  const fn = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => res);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("request", () => {
  it("ส่ง json เป็น body พร้อม Content-Type และคืนข้อมูล", async () => {
    const fetch = mockFetch(Response.json({ id: 1 }, { status: 201 }));
    const data = await request<{ id: number }>("/api/v1/x", { method: "POST", json: { a: 1 }, headers: { Accept: "application/json" } });
    expect(data).toEqual({ id: 1 });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/v1/x");
    expect(init?.body).toBe('{"a":1}');
    const headers = new Headers(init?.headers);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("accept")).toBe("application/json");
  });

  it("ไม่มี json → ไม่ตั้ง Content-Type (FormData ให้เบราว์เซอร์ใส่ boundary เอง)", async () => {
    const fetch = mockFetch(Response.json({}));
    const form = new FormData();
    await request("/api/v1/uploads", { method: "POST", body: form });
    const init = fetch.mock.calls[0][1];
    expect(init?.body).toBe(form);
    expect(new Headers(init?.headers).has("content-type")).toBe(false);
  });

  it("204 → undefined", async () => {
    mockFetch(new Response(null, { status: 204 }));
    await expect(request("/api/v1/auth/logout")).resolves.toBeUndefined();
  });

  it("error ของ Go → ApiError พร้อม code/details", async () => {
    mockFetch(Response.json({ error: { code: "SEATS_EXCEEDED", message: "ที่นั่งไม่พอ", details: { used: 7 } } }, { status: 409 }));
    const e = await request("/api/v1/x").catch((e) => e);
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ status: 409, code: "SEATS_EXCEEDED", message: "ที่นั่งไม่พอ", details: { used: 7 } });
  });

  it("body ไม่ใช่ JSON (เช่น proxy ตอบ HTML ตอน 502) → ข้อความกลาง ไม่พัง", async () => {
    mockFetch(new Response("<html>Bad Gateway</html>", { status: 502 }));
    const e = await request("/api/v1/x").catch((e) => e);
    expect(e).toMatchObject({ status: 502, code: "INTERNAL", message: "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง", details: null });
  });
});

describe("ApiError.fieldErrors", () => {
  it("เฉพาะ VALIDATION", () => {
    expect(new ApiError(400, "VALIDATION", "x", { email: "ซ้ำ" }).fieldErrors).toEqual({ email: "ซ้ำ" });
    expect(new ApiError(409, "SEATS_EXCEEDED", "x", { used: 7 }).fieldErrors).toEqual({});
    expect(new ApiError(400, "VALIDATION", "x", null).fieldErrors).toEqual({});
  });
});

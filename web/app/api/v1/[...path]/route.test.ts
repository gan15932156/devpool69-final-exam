import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// BFF ที่แนบ token ของ Go ให้ทุกคำขอ /api/v1/* · ทดสอบด่านความปลอดภัย: path traversal · CSRF · header ที่ส่งต่อ

const getToken = vi.fn();
vi.mock("next-auth/jwt", () => ({ getToken: (...args: unknown[]) => getToken(...args) }));

vi.stubEnv("API_URL", "http://go.test");
const { GET, POST } = await import("./route");

const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", "secret");
  getToken.mockReset().mockResolvedValue({ accessToken: "go-token" });
  fetchMock.mockReset().mockResolvedValue(Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function call(handler: typeof GET, path: string[], init: RequestInit & { url?: string } = {}) {
  const req = new NextRequest(init.url ?? `http://web.test/api/v1/${path.join("/")}`, init as ConstructorParameters<typeof NextRequest>[1]);
  return handler(req, { params: Promise.resolve({ path }) });
}

const forwarded = () => {
  const [url, init] = fetchMock.mock.calls[0];
  return { url, init, headers: new Headers(init.headers) };
};

describe("ส่งต่อไป Go", () => {
  it("แนบ token จาก session cookie และส่งต่อเฉพาะ header ที่อนุญาต", async () => {
    const res = await call(GET, ["me"], {
      headers: {
        cookie: "authjs.session-token=abc",
        authorization: "Bearer client-supplied-token",
        accept: "application/json",
        "x-forwarded-for": "203.0.113.7",
        "x-custom": "drop-me",
      },
    });
    expect(res.status).toBe(200);
    const { url, headers } = forwarded();
    expect(url).toBe("http://go.test/api/v1/me");
    expect(headers.get("authorization")).toBe("Bearer go-token"); // ไม่ใช่ตัวที่ client แนบมา
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("x-forwarded-for")).toBe("203.0.113.7");
    expect(headers.has("cookie")).toBe(false);
    expect(headers.has("x-custom")).toBe(false);
  });

  it("getToken อ่านจาก cookie เท่านั้น (ไม่อ่าน Bearer ที่ client ส่งมา) · ลอง cookie ทั้ง 2 ชื่อ", async () => {
    getToken.mockResolvedValueOnce(null).mockResolvedValueOnce({ accessToken: "from-http-cookie" });
    await call(GET, ["me"], { headers: { cookie: "c=1", authorization: "Bearer evil" } });
    expect(getToken).toHaveBeenCalledTimes(2);
    for (const [arg] of getToken.mock.calls) {
      expect(arg.req.headers).toEqual({ cookie: "c=1" });
      expect(arg.secret).toBe("secret");
    }
    expect(getToken.mock.calls.map(([a]) => a.secureCookie)).toEqual([true, false]);
    expect(forwarded().headers.get("authorization")).toBe("Bearer from-http-cookie");
  });

  it("ไม่ได้ login / ไม่มี AUTH_SECRET → ไม่แนบ Authorization", async () => {
    getToken.mockResolvedValue(null);
    await call(GET, ["restaurants"]);
    expect(forwarded().headers.has("authorization")).toBe(false);

    fetchMock.mockClear();
    getToken.mockClear();
    vi.stubEnv("AUTH_SECRET", "");
    await call(GET, ["restaurants"]);
    expect(getToken).not.toHaveBeenCalled();
    expect(forwarded().headers.has("authorization")).toBe(false);
  });

  it("encode แต่ละส่วนของ path และคง query string", async () => {
    await call(GET, ["restaurants", "a b", "x?y"], { url: "http://web.test/api/v1/restaurants/a%20b/x%3Fy?q=ส้มตำ&sort=rating" });
    expect(forwarded().url).toBe(`http://go.test/api/v1/restaurants/a%20b/x%3Fy?q=${encodeURIComponent("ส้มตำ")}&sort=rating`);
  });

  it("POST ส่ง body ต่อ · GET ไม่ส่ง body · ไม่แคช · ไม่ตาม redirect", async () => {
    await call(POST, ["auth", "login"], { method: "POST", body: '{"email":"a"}', headers: { "content-type": "application/json", "sec-fetch-site": "same-origin" } });
    const post = forwarded();
    expect(post.init.method).toBe("POST");
    expect(await new Response(post.init.body).text()).toBe('{"email":"a"}');
    expect(post.headers.get("content-type")).toBe("application/json");
    expect(post.init).toMatchObject({ cache: "no-store", redirect: "manual" });

    fetchMock.mockClear();
    await call(GET, ["me"]);
    expect(forwarded().init.body).toBeUndefined();
  });
});

describe("คำตอบที่ส่งกลับ", () => {
  it("คง status และส่งกลับเฉพาะ header ที่อนุญาต (ไม่ส่ง set-cookie ของ Go)", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { error: { code: "TOO_MANY_REQUESTS" } },
        { status: 429, headers: { "retry-after": "60", "x-ratelimit-limit": "10", "set-cookie": "x=1", server: "fiber" } },
      ),
    );
    const res = await call(GET, ["me"]);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(res.headers.get("x-ratelimit-limit")).toBe("10");
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.has("set-cookie")).toBe(false);
    expect(res.headers.has("server")).toBe(false);
    expect(await res.json()).toEqual({ error: { code: "TOO_MANY_REQUESTS" } });
  });

  it("204 ไม่มี body", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const res = await call(POST, ["auth", "logout"], { method: "POST", headers: { "sec-fetch-site": "same-origin" } });
    expect(res.status).toBe(204);
    expect(res.body).toBeNull();
  });

  it("Go ล่ม → 502 รูปแบบ error เดียวกับ Go", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const res = await call(GET, ["me"]);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: { code: "BAD_GATEWAY", message: "เชื่อมต่อ API ไม่ได้ ลองใหม่อีกครั้ง", details: null } });
  });
});

describe("ด่านความปลอดภัย", () => {
  it.each([[["."]], [[".."]], [["restaurants", ".."]], [["..", "..", "admin"]]])("path %j → 404 ไม่ส่งต่อ", async (path) => {
    const res = await call(GET, path);
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["cross-site", "same-site", "none"])("POST จาก Sec-Fetch-Site: %s → 403 ไม่ส่งต่อ (กัน CSRF)", async (site) => {
    const res = await call(POST, ["restaurants", "1", "bookings"], { method: "POST", body: "{}", headers: { "sec-fetch-site": site } });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POST จากหน้าเว็บเดียวกันผ่าน", async () => {
    const res = await call(POST, ["bookings", "1", "cancel"], { method: "POST", headers: { "sec-fetch-site": "same-origin" } });
    expect(res.status).toBe(200);
  });

  it("GET ข้ามเว็บผ่าน (อ่านอย่างเดียว ไม่เปลี่ยนข้อมูล)", async () => {
    const res = await call(GET, ["restaurants"], { headers: { "sec-fetch-site": "cross-site" } });
    expect(res.status).toBe(200);
  });

  it("ไม่มี Sec-Fetch-Site (ไม่ใช่เบราว์เซอร์ เช่น curl) ผ่าน · เบราว์เซอร์ใส่ header นี้ให้เสมอ จึงยังกันเว็บอื่นได้", async () => {
    const res = await call(POST, ["auth", "logout"], { method: "POST" });
    expect(res.status).toBe(200);
  });
});

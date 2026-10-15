import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

// ตัวกลางระหว่างเบราว์เซอร์กับ Go (Backend for Frontend) — ทุกคำขอ /api/v1/* จากหน้าเว็บผ่านที่นี่
// token ของ Go อยู่ใน session cookie ที่เข้ารหัสและเป็น httpOnly → JavaScript ในหน้าเว็บไม่เคยเห็น token
// route นี้ถอด cookie ฝั่ง server แล้วแนบ "Authorization: Bearer" ให้ ก่อนส่งต่อไปที่ ${API_URL}/api/v1/...
const API_URL = process.env.API_URL ?? "http://localhost:8080";

// header ที่ส่งต่อ (ที่เหลือทิ้ง เช่น cookie ไม่ต้องไปถึง Go · Authorization ที่ client แนบมาเองไม่ใช้)
const REQUEST_HEADERS = ["accept", "content-type", "x-forwarded-for"];
const RESPONSE_HEADERS = ["content-type", "retry-after", "x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset"];

const fail = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message, details: null } }, { status });

// token ของ Go จาก session cookie · ชื่อ cookie มี 2 แบบ (https ขึ้นต้น __Secure-) ลองทั้งคู่
async function accessToken(req: NextRequest) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return undefined;
  const onlyCookie = { headers: { cookie: req.headers.get("cookie") ?? "" } }; // ไม่ส่ง Authorization → getToken ไม่ไปอ่าน Bearer ที่ client แนบมา
  for (const secureCookie of [true, false]) {
    const token = await getToken({ req: onlyCookie, secret, secureCookie });
    if (token?.accessToken) return token.accessToken;
  }
  return undefined;
}

async function handle(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (path.some((p) => p === "." || p === "..")) return fail(404, "NOT_FOUND", "ไม่พบข้อมูล"); // กันหนีออกนอก /api/v1

  // กัน CSRF: ตอนนี้ cookie คือสิ่งที่ยืนยันตัวตน → คำขอที่เปลี่ยนข้อมูลต้องมาจากหน้าเว็บนี้เท่านั้น
  // (เบราว์เซอร์ใส่ Sec-Fetch-Site ให้เอง เว็บอื่นปลอมไม่ได้ · cookie ของ NextAuth เป็น SameSite=Lax อีกชั้น)
  const site = req.headers.get("sec-fetch-site");
  if (req.method !== "GET" && site && site !== "same-origin") return fail(403, "FORBIDDEN", "คุณไม่มีสิทธิ์ทำรายการนี้");

  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  const token = await accessToken(req);
  if (token) headers.set("authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`, {
      method: req.method,
      headers,
      body: req.method === "GET" ? undefined : req.body,
      duplex: "half", // ส่ง body (เช่นรูปที่อัปโหลด) ต่อแบบ stream ไม่ต้องอ่านทั้งก้อนก่อน
      cache: "no-store", // ที่นั่ง/การจองต้องสดเสมอ ห้าม Next แคชคำตอบ
      redirect: "manual", // ไม่ตาม redirect เองฝั่ง server · ส่งคำตอบของ Go กลับไปตามจริง
    } as RequestInit);
  } catch {
    return fail(502, "BAD_GATEWAY", "เชื่อมต่อ API ไม่ได้ ลองใหม่อีกครั้ง");
  }

  const out = new Headers();
  for (const name of RESPONSE_HEADERS) {
    const value = res.headers.get(name);
    if (value) out.set(name, value);
  }
  return new Response(res.status === 204 ? null : res.body, { status: res.status, headers: out });
}

export { handle as GET, handle as POST, handle as PUT, handle as DELETE };

# Phase 1 — Models + Auth

**ผลลัพธ์:** สมัคร → login → หน้าเว็บรู้ว่าเป็นใคร · หน้าที่ต้อง login พาไปหน้า login แล้วกลับมาที่เดิม · header / tab bar ตามดีไซน์

## ไฟล์หลัก

| ไฟล์ | หน้าที่ |
|---|---|
| `api/internal/models/models.go` | ตาราง User, Restaurant, RestaurantImage, Booking, Review |
| `api/internal/database/database.go` | ต่อ DB + AutoMigrate |
| `api/internal/apperr/apperr.go` | รูปแบบ error กลาง + error handler |
| `api/internal/handlers/auth.go` | register / login / me |
| `api/internal/middleware/auth.go` | อ่าน `Authorization: Bearer` → userID |
| `api/internal/seed/seed.go` | ข้อมูลตัวอย่างเบื้องต้น (Phase 7 จะขยาย) |
| `api/requests.http` | ชุดทดสอบ API (VS Code REST Client) |
| `web/auth.ts` | NextAuth: Credentials provider เรียก Go |
| `web/lib/api.ts`, `web/lib/use-api.ts` | ตัวเรียก API + แนบ token + จัดการ 401 |
| `web/app/(auth)/login`, `register` | หน้า login / สมัคร |
| `web/components/layout/*` | Header, TabBar, AvatarMenu, AuthShell |

## Auth flow

```
ฟอร์ม login ─► signIn("credentials") ─► NextAuth authorize() (ฝั่ง server)
   ─► POST Go /api/v1/auth/login ─► Go ตรวจ bcrypt → คืน JWT ที่ Go เซ็นเอง (HS256, 7 วัน)
   ─► NextAuth เก็บ accessToken ใน session cookie (เข้ารหัส) ─► หน้าเว็บแนบ Authorization: Bearer ตอนเรียก Go
```

## การตัดสินใจ และเหตุผล

| เรื่อง | เลือก | ทำไม | ทางอื่นที่ไม่เลือก |
|---|---|---|---|
| ใครเป็นเจ้าของข้อมูลผู้ใช้ | **Go** (ตาราง users + bcrypt) | โจทย์ให้ Go เป็น backend · กติกาสิทธิ์ต้องอยู่ที่ Go · NextAuth แค่ถือ token | ให้ NextAuth ต่อ DB เอง (adapter): logic สิทธิ์จะแยกสองที่ |
| Token | **JWT HS256 ที่ Go เซ็น** | Go ตรวจเองได้ทุก request ไม่ต้องเก็บ session ใน DB | session table: ต้อง query DB ทุก request |
| ตรวจ JWT | middleware เขียนเอง ~20 บรรทัด + `jwt.WithValidMethods(["HS256"])` | กันการโจมตีเปลี่ยน alg เป็น `none` หรือ alg อื่น · โค้ดสั้นพออธิบายได้ | lib middleware สำเร็จรูป: ซ่อนสิ่งที่ต้องอธิบาย |
| อายุ token | 7 วัน เท่ากับ session ของ NextAuth | token หมดพร้อม session · ถ้า Go ตอบ 401 หน้าเว็บ sign out ให้ | — |
| รหัสผ่าน | **bcrypt** (`golang.org/x/crypto`) | ช้าโดยตั้งใจ กันเดารหัสแบบ brute force · มี salt ในตัว · จำกัด 72 byte จึงตรวจความยาวก่อน | SHA-256: เร็วเกินไป ไม่เหมาะกับรหัสผ่าน |
| login ผิด | ข้อความเดียวกันทั้ง "ไม่มีอีเมล" และ "รหัสผิด" | กันคนเดาว่าอีเมลไหนมีบัญชี | — |
| อีเมลซ้ำ | unique index + `TranslateError: true` | ให้ DB เป็นตัวกันจริง (กันกรณีสมัครพร้อมกัน) แล้วแปลง error เป็น 409 `EMAIL_TAKEN` | เช็กด้วย SELECT ก่อน INSERT: มีช่องให้สองคนสมัครพร้อมกันผ่าน |
| อีเมล | trim + lowercase ก่อนเก็บ | `Mali@x.com` กับ `mali@x.com` ต้องเป็นคนเดียวกัน | — |
| เวลาเปิด/ปิด | เก็บเป็น **นาทีนับจากเที่ยงคืน** (11:00 = 660) | บวกลบเทียบง่าย ไม่มีเรื่องวันที่/timezone ปน | type `time`: เทียบข้ามเที่ยงคืนยาก |
| เวลาการจอง | `StartAt`/`EndAt` เป็น **timestamptz** | ร้านข้ามเที่ยงคืนทำให้ "วันที่" กับ "เวลา" แยกกันไม่ได้ · เก็บเป็นจุดเวลาจริงแล้วเทียบช่วงซ้อนกันด้วย `<` `>` ได้ตรง ๆ | date + time แยกคอลัมน์: 01:00 ของร้านโต้รุ่งต้องมีกรณีพิเศษทุก query |
| `ServiceDate` | คอลัมน์ `date` แยก | บอกว่าเป็น "รอบ" ของคืนไหน ใช้แสดงผล/กรองเท่านั้น (ตรวจที่นั่งใช้ StartAt/EndAt) | — |
| กติกาที่ DB | `CHECK` (seats > 0, lead ≥ 30, rating 1–5, end > start) + FK `ON DELETE CASCADE` | ถ้าโค้ดมี bug ข้อมูลผิดก็ยังเข้า DB ไม่ได้ (ป้องกันชั้นสุดท้าย) | ตรวจแค่ในโค้ด |
| error กลาง | ทุก error ตอบ `{ error: { code, message, details } }` | หน้าเว็บจัดการได้แบบเดียว · `code` ใช้ตัดสินใจ, `details` ใช้ชี้ช่องที่ผิด | ส่งข้อความล้วน: หน้าเว็บแยกประเภท error ไม่ได้ |
| error ที่ไม่ได้ตั้งใจ | log ไว้ แต่ตอบแค่ `INTERNAL` | ไม่ส่งรายละเอียดภายใน (SQL, path) ออกไป | — |
| NextAuth | **v5 beta.32 ล็อกเวอร์ชันตรง** (`--save-exact`) | รองรับ App Router · beta เปลี่ยนบ่อย ล็อกไว้กันพังตอนติดตั้งใหม่ | v4: ออกแบบมาสำหรับ Pages Router |
| `AUTH_SECRET` | สร้างด้วย `node -e "crypto.randomBytes(32)"` | **`npx auth secret` ตอนนี้ไปเรียกแพ็กเกจของ better-auth** และได้ `BETTER_AUTH_SECRET` ซึ่ง NextAuth ไม่อ่าน | — |
| ส่ง session ให้ client | `auth()` ใน root layout → `<SessionProvider session>` | หน้าเว็บรู้สถานะ login ทันทีตั้งแต่ render แรก ไม่มีจังหวะ "กำลังโหลด" | ให้ client fetch เอง: header กระพริบ |
| หลัง login | `window.location.assign()` (โหลดทั้งหน้า) | header ที่ render ฝั่ง server และ session ฝั่ง client อัปเดตพร้อมกันแน่นอน | `router.push`: บางส่วนยังเห็น session เก่า |
| เรียก API ฝั่ง client | hook `useApi()` แนบ token + 401 → signOut | เขียนที่เดียว ทุกหน้าได้ | ใส่ header เองทุกที่ |
| Data fetching | **TanStack Query** | cache, loading/error state, refetch เมื่อ key เปลี่ยน, invalidate หลังจองสำเร็จ | useEffect + useState: ต้องจัดการ loading/cache/race เอง |
| ฟอร์ม | **react-hook-form + zod** | ไม่ re-render ทั้งฟอร์มทุกตัวอักษร · schema เดียวได้ทั้ง validate และ type | จัดการ state เอง: โค้ดยาว |
| checklist รหัสผ่าน | `useWatch` ไม่ใช่ `watch()` | ESLint (React Compiler) เตือนว่า `watch()` memoize ไม่ได้ | — |
| กันหน้าที่ต้อง login | `requireSession()` ในแต่ละ page | Next 16 เปลี่ยน middleware เป็น proxy · เช็กในหน้าตรง ๆ อ่านง่ายกว่า และกันที่ Go อยู่แล้ว | proxy.ts: อีกชั้นที่ต้องอธิบาย |
| callbackUrl | รับเฉพาะ `/xxx` ไม่รับ `//xxx` | กัน open redirect ไปเว็บอื่น | — |
| Route groups | `(main)` มี header/tab bar · `(auth)` ไม่มี | ตามดีไซน์ · ชื่อในวงเล็บไม่โผล่ใน URL | — |
| เมนูบัญชี | `<details>` | เปิด/ปิดได้ ใช้คีย์บอร์ดได้ ไม่ต้องเขียน state | — |
| ไอคอน | **lucide-react** | ดีไซน์ใช้ไอคอนสไตล์ Lucide (HANDOFF §4) | — |

## ข้อแลกที่ต้องรู้

> **client อ่าน token ได้** (ผ่าน `useSession()`) — ถ้าเว็บมีช่องโหว่ XSS token อาจถูกขโมย · รับได้เพราะ: React escape ข้อความให้อัตโนมัติ, ไม่มี `dangerouslySetInnerHTML`, token อายุจำกัด 7 วัน · ถ้าจะทำให้แน่นกว่านี้ ต้องให้ทุก request ผ่าน server ของ Next (BFF) แล้วไม่ส่ง token ลง browser เลย

## ทดสอบแล้ว

- `requests.http` หมวด Phase 1 · สมัครซ้ำ (ต่างตัวพิมพ์) → 409 · รหัสไม่มีตัวเลข → 400 · login ผิด 2 แบบได้ข้อความเหมือนกันทุกตัวอักษร
- token ปลอม / `alg: none` / แก้ payload → 401
- login ผ่านเว็บ → cookie อายุ 7 วัน · `/api/auth/session` มี `accessToken` + `user.id`
- ยังไม่ login เปิด `/bookings` → `/login?callbackUrl=%2Fbookings`

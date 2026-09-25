# โต๊ะว่าง — Development Walkthrough

แผนพัฒนาแบบทำทีละขั้น (25 ก.ย. – 11 ต.ค. 2569) · ดีไซน์อ้างอิง: [design/HANDOFF.md](design/HANDOFF.md)

---

## สิ่งที่ตกลงแล้ว

**Stack**
- Frontend: Next.js 16 (App Router, TypeScript) · Tailwind v4 · NextAuth v5 (Credentials) · TanStack Query · react-hook-form + zod · date-fns · lucide-react
- Backend: Go · Fiber v3 · GORM · PostgreSQL 16 · JWT (HS256) · bcrypt
- Infra: Docker Compose · **ไม่มี backend test** · ไม่ใช้ Makefile (เครื่องไม่มี `make`) → คำสั่งอยู่ใน README

**Auth flow:** Login form → `signIn("credentials")` → NextAuth `authorize()` ยิง Go `/api/v1/auth/login` → Go ตรวจ bcrypt แล้วคืน JWT ที่ Go เซ็นเอง → NextAuth เก็บไว้ใน session → หน้าเว็บแนบ `Authorization: Bearer` ตอนเรียก Go

**ข้อ [ต้องคุย] ใน HANDOFF §6**
| # | เรื่อง | ตัดสินใจ |
|---|---|---|
| 1 | เวลาจองทีละ 30 นาที | บังคับที่ backend |
| 2 | แก้ไขหลังเลยเวลายกเลิก | ไม่ได้ |
| 3 | จองที่นั่งสุดท้ายพร้อมกัน | transaction + `SELECT … FOR UPDATE` ที่แถวร้าน |
| 4 | ค่าเฉลี่ยรีวิว | คำนวณสด (`AVG`, `COUNT`) |
| 5 | รีวิวกี่ครั้ง | 1 คน / 1 ร้าน (unique) แก้ได้ ไม่ต้องเคยจอง |
| 6 | เรียงคะแนน | ร้านที่รีวิว < 5 ไปท้าย |
| 7 | Breakpoint | < 768 มือถือ · ≥ 1024 desktop |

**ค่าเริ่มต้นของเรื่องที่น่าจะเจอระหว่างเขียน (เปลี่ยนได้)**
| เรื่อง | ค่าเริ่มต้น |
|---|---|
| ลบร้านที่ยังมีการจองในอนาคต | ห้ามลบ ตอบ 409 |
| ลดที่นั่ง / เปลี่ยนเวลาเปิด-ปิด ตอนมีการจองอยู่แล้ว | การจองเดิมยังอยู่ กติกาใหม่ใช้กับการจองใหม่หรือการแก้ไขครั้งต่อไป |
| เจ้าของจองร้านตัวเอง | อนุญาต (โจทย์ห้ามแค่รีวิวร้านตัวเอง) |
| จองล่วงหน้าได้ไกลสุด | backend ไม่จำกัด · หน้าเว็บแสดง 5 วัน |
| เวลาเปิด/ปิดร้าน | ต้องลงที่ :00 หรือ :30 และเปิด ≠ ปิด |
| ประเภทร้าน (cuisine) | เพิ่มช่องในฟอร์ม (ไม่บังคับกรอก) เพราะการ์ดแสดง แต่ฟอร์มในดีไซน์ไม่มี |

---

## ข้อควรรู้ก่อนเริ่ม

- [ ] เปิด **Rancher Desktop** ก่อน (Docker daemon ยังไม่รัน)
- **Fiber v3 ≠ v2:** handler เป็น `func(c fiber.Ctx) error` (ไม่มี `*`), อ่าน body ด้วย `c.Bind().Body(&req)`, ไม่มี `app.Static` ให้ใช้ `middleware/static` — ตัวอย่างบนเน็ตส่วนใหญ่ยังเป็น v2
- **Next.js 16:** `middleware.ts` เปลี่ยนชื่อเป็น `proxy.ts` และ `params` ของ page เป็น Promise → `const { id } = await params`
- **NextAuth v5 ยังเป็น beta** → ล็อกเวอร์ชัน `next-auth@5.0.0-beta.32`
- **Go routes อยู่ใต้ `/api/v1/...`** เพราะ Next ใช้ `/api/auth/*` ของ NextAuth อยู่แล้ว ถ้า rewrite ทั้ง `/api/*` จะชนกัน

## ตารางเวลา

| วัน | Phase |
|---|---|
| 25 ก.ย. | 0 ตั้งโปรเจกต์ |
| 26–27 | 1 Models + Auth |
| 28–29 | 2 ร้าน |
| 30 ก.ย. – 2 ต.ค. | **3 การจอง (แกนหลัก)** |
| 3–4 | 4 การจองของฉัน |
| 5–6 | 5 รีวิว + การเรียง |
| 7 | 6 Dashboard เจ้าของร้าน |
| 8–9 | 7 Seed · Docker · README · responsive |
| 10–11 | 8 วิดีโอ + เผื่อเวลา · **ส่ง 11 ต.ค.** |

---

## Phase 0 — ตั้งโปรเจกต์

**เป้าหมาย:** เปิดได้ครบ DB + API + เว็บ แม้ยังไม่มีฟีเจอร์

**Root**
- [ ] `git init` + `.gitignore` (`node_modules`, `.next`, `.env*`, `api/uploads/*`, `api/tmp`)
- [ ] `docker-compose.yml` มีแค่ service `db` (`postgres:16-alpine`) + healthcheck `pg_isready` + volume

**api/**
- [ ] `go mod init toawang`
- [ ] `go get github.com/gofiber/fiber/v3 gorm.io/gorm gorm.io/driver/postgres github.com/golang-jwt/jwt/v5 golang.org/x/crypto`
- [ ] โครงไฟล์ `cmd/api/main.go`, `internal/{config,database,models,handlers,middleware,booking}`
- [ ] `main.go`: อ่าน env → ต่อ DB → `GET /api/v1/health`
- [ ] `fiber.Config{BodyLimit: 10 * 1024 * 1024}` (default 4MB ไม่พอสำหรับรูป)
- [ ] `import _ "time/tzdata"` ไม่งั้น `time.LoadLocation("Asia/Bangkok")` อาจพังบน Windows/alpine

**web/**
- [ ] `npx create-next-app@latest web --ts --tailwind --eslint --app --use-npm --disable-git`
- [ ] ลบ dark mode ที่ template ใส่มาใน `globals.css`
- [ ] ย้ายค่าจาก `design/tokens/tokens.css` ไปไว้ใน `@theme` (เช่น `--color-indigo: #1E2B5E;` → ได้ `bg-indigo`, `text-vermilion`)
- [ ] ฟอนต์ `next/font/google`: Pridi (600), Sarabun (400–700), subsets `thai` + `latin` → ผูกด้วย `@theme inline { --font-heading: var(--font-pridi); }`
- [ ] copy `design/assets/*` → `web/public/design/`
- [ ] `next.config.ts` rewrites: `/api/v1/:path*` และ `/uploads/:path*` → `${API_URL}`

✅ **เสร็จเมื่อ:** เปิด `http://localhost:3000/api/v1/health` เห็น `{"status":"ok"}` (ผ่าน rewrite ไปถึง Go)

---

## Phase 1 — Models + Auth

**Models (GORM)**
| Model | ฟิลด์หลัก |
|---|---|
| User | Name, Email (unique, lowercase), PasswordHash (`json:"-"`) |
| Restaurant | OwnerID, Name, Cuisine, Description, Seats, OpenMinute, CloseMinute, CancelLeadMinutes (default 30) |
| RestaurantImage | RestaurantID, URL, Position |
| Booking | RestaurantID, UserID, PartySize, ServiceDate (`type:date`), StartAt, EndAt (timestamptz), Status (`confirmed`/`cancelled`), CancelledAt |
| Review | RestaurantID + UserID (uniqueIndex คู่), Rating, Comment |

- [ ] เวลาเปิด/ปิดเก็บเป็น **นาทีนับจากเที่ยงคืน** (11:00 = 660)
- [ ] `check:` constraint ที่ DB: `seats > 0`, `cancel_lead_minutes >= 30`, `rating BETWEEN 1 AND 5`, `end_at > start_at`
- [ ] `AutoMigrate` ตอน start
- [ ] `ServiceDate` ใช้แสดงผล/กรองเท่านั้น — การตรวจที่นั่งใช้ `StartAt`/`EndAt`

**Go auth**
- [ ] `POST /api/v1/auth/register` — รหัส ≥ 8 + มีตัวเลข · bcrypt · อีเมลซ้ำ → 409
- [ ] `POST /api/v1/auth/login` → `{user, accessToken}` (JWT อายุ 7 วัน) · ผิด → 401 ข้อความเดียว
- [ ] middleware เขียนเอง (~20 บรรทัด): อ่าน `Authorization: Bearer` → `jwt.ParseWithClaims(..., jwt.WithValidMethods([]string{"HS256"}))` → `c.Locals("userID", id)`
- [ ] `GET /api/v1/me`
- [ ] error handler กลาง: ทุก error ตอบ `{ "error": { "code", "message", "details" } }`

**Next auth**
- [ ] `auth.ts`: Credentials provider เรียก Go login · เก็บ `accessToken` ใน `jwt` / `session` callback · `session.maxAge` = 7 วัน
- [ ] `app/api/auth/[...nextauth]/route.ts` → `export const { GET, POST } = handlers`
- [ ] `types/next-auth.d.ts` ประกาศ `accessToken` ใน Session และ JWT
- [ ] env: `AUTH_SECRET` (`npx auth secret`), `AUTH_TRUST_HOST=true`, `API_URL=http://localhost:8080`
- [ ] `lib/api.ts`: `apiFetch()` แนบ Bearer · โยน `ApiError` พร้อม code · 401 → `signOut()`
- [ ] `providers.tsx` (`'use client'`): `SessionProvider` + `QueryClientProvider`
- [ ] หน้า `/login`, `/register` (react-hook-form + zod) · สมัครเสร็จ → `signIn` ต่อทันที · สวิตช์ "อยากเปิดร้าน" → `/owner/restaurants/new`
- [ ] หน้าที่ต้อง login: `const session = await auth(); if (!session) redirect("/login")`

> ⚠️ ข้อแลก: client อ่าน token ได้ผ่าน session — ยอมรับได้สำหรับงานนี้ แต่เตรียมคำตอบไว้เผื่อกรรมการถาม

**Seed เริ่มตั้งแต่ตอนนี้**
- [ ] `cmd/seed`: user 2 คน + ร้าน 2 ร้าน (จะได้ทำ Phase 3 โดยไม่ต้องรอหน้าฟอร์มร้าน)

✅ **เสร็จเมื่อ:** สมัคร → login → หน้าเว็บเรียก `/api/v1/me` ได้ชื่อตัวเอง

---

## Phase 2 — ร้าน

**API**
| Method | Path | หมายเหตุ |
|---|---|---|
| GET | `/restaurants?q=&sort=rating\|reviews` | |
| GET | `/restaurants/:id` | รูป · ค่าเฉลี่ย · จำนวนรีวิว · การกระจายดาว |
| POST | `/restaurants` | owner = user ที่ login |
| PUT | `/restaurants/:id` | เจ้าของเท่านั้น |
| DELETE | `/restaurants/:id` | เจ้าของเท่านั้น · มีการจองในอนาคต → 409 |
| GET | `/me/restaurants` | |
| POST | `/uploads` | multipart → `{url}` |

- [ ] เช็กเจ้าของที่ API ทุกครั้ง: `restaurant.OwnerID != userID` → 403
- [ ] Upload: ตรวจชนิดด้วย `http.DetectContentType` (512 byte แรก) รับ jpg/png/webp ≤ 5MB · ตั้งชื่อไฟล์สุ่ม ห้ามใช้ชื่อที่ผู้ใช้ส่ง
- [ ] ตรวจฟอร์มที่ Go: รูป ≥ 1 · ที่นั่ง > 0 · เวลายกเลิก ≥ 30 · เปิด ≠ ปิด · เวลาลงที่ :00/:30

**หน้าเว็บ**
- [ ] `/` ค้นหา: ช่องค้นหา + segmented เรียง + การ์ด (ตราคะแนน, badge ร้านของคุณ / ข้ามเที่ยงคืน / รีวิวยังน้อย)
- [ ] `/restaurants/[id]` (ยังไม่มีใบจอง)
- [ ] ฟอร์มเดียวใช้ทั้ง `/owner/restaurants/new` และ `/owner/restaurants/[id]/edit` · stepper เวลายกเลิกทีละ 15 นาที + ปุ่มลัด 30น./1ชม./2ชม./3ชม.

✅ **เสร็จเมื่อ:** สร้างร้านพร้อมรูปแล้วเห็นในหน้าค้นหา · login เป็นคนอื่นแล้วยิง PUT ได้ 403

---

## Phase 3 — การจอง (แกนหลัก · ใช้อธิบายในวิดีโอ)

logic ทั้งหมดอยู่ใน `internal/booking/` แยกจาก handler

**Input:** `{ "date": "2026-09-25", "start": "18:00", "end": "01:30", "partySize": 4 }`

**① แปลงเป็นเวลาจริง (Asia/Bangkok)**
```
windowStart = date + open
windowEnd   = date + close   (+24 ชม. ถ้า close <= open  ← ร้านข้ามเที่ยงคืน)
t ("HH:MM") → ถ้าร้านข้ามเที่ยงคืน และ t < open → เป็นเวลาของวันถัดไป
```

**② ตรวจตามลำดับ (แต่ละข้อ error code ต่างกัน)**
- [ ] start / end ลงที่ :00 หรือ :30 และ end > start
- [ ] `windowStart <= startAt` และ `endAt <= windowEnd`
- [ ] `startAt` ยังไม่ผ่านไป
- [ ] partySize ≥ 1
- [ ] ที่นั่ง (③)

**③ ตรวจที่นั่งใน transaction**
```go
db.Transaction(func(tx *gorm.DB) error {
    // 1. lock แถวร้าน → การจองร้านเดียวกันเข้าคิวทีละรายการ
    tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&r, id)
    // 2. ดึงการจองที่ซ้อนกับช่วงที่ขอ
    //    status = 'confirmed' AND start_at < endAt AND end_at > startAt AND id <> excludeID
    // 3. วนทีละช่อง 30 นาที: used = ผลรวม party ของการจองที่คร่อมช่องนั้น
    //    used + party > seats → return error พร้อม {slotStart, used, party, seats}
    // 4. ผ่านทุกช่อง → tx.Create(&booking)
})
```
> ⚠️ ใน `Transaction` ต้องใช้ **`tx`** ทุกคำสั่ง — เผลอใช้ `db` ข้างนอก query นั้นจะหลุดจาก transaction และ lock ไม่มีผล

**API**
- [ ] `GET /restaurants/:id/availability?date=&excludeBookingId=` → `[{ "start": "11:00", "used": 7 }, ...]` (query เดียวกับข้อ ③)
- [ ] `POST /restaurants/:id/bookings` → ที่นั่งไม่พอตอบ **409** `SEATS_EXCEEDED` + details (หน้าเว็บเขียนข้อความเอง เช่น "ช่วง 12:00–12:30 จองแล้ว 7 + คุณ 4 = 11 เกิน 10 ที่")
- [ ] response ส่ง `serviceDate`, `start`, `end` เป็นสตริงเวลาไทยด้วย (หน้าเว็บไม่ต้องจัดการ timezone)

**หน้าเว็บ — ใบจองโต๊ะ**
- [ ] stepper จำนวนคน (− ปิดที่ 1, + ปิดที่จำนวนที่นั่งร้าน)
- [ ] เลือกวันที่ 5 วัน (วันนี้ + 4) ทรงซุ้มเล็ก
- [ ] เลือกเวลาทีละ 30 นาที (ร้านข้ามเที่ยงคืน: รายการเวลาต่อไปถึงหลัง 00:00)
- [ ] กราฟที่นั่ง (div ธรรมดา) + checklist ✓/✕ คำนวณแบบเดียวกับ `renderVals()` ใน [Restaurant.dc.html](design/reference/desktop/Restaurant.dc.html) บรรทัด 287
- [ ] แสดง error ที่ Go ตอบกลับเสมอ — ผลคำนวณฝั่งหน้าเว็บเป็นแค่ตัวช่วย UX
- [ ] หมายเหตุ "ยกเลิกได้ถึง HH:MM ของวันที่จอง"

**เช็กด้วย `requests.http`** (VS Code REST Client) ยิงตรงไปที่ Go ข้ามหน้าเว็บ
- [ ] นอกเวลาเปิด → ถูกปฏิเสธ
- [ ] เวลาที่ผ่านไปแล้ว → ถูกปฏิเสธ
- [ ] ที่นั่งเกิน → 409
- [ ] ร้าน 18:00–02:00 จองตอน 01:00 → ผ่าน
- [ ] เวลาไม่ลง :00/:30 → ถูกปฏิเสธ

✅ **เสร็จเมื่อ:** ทุกเคสข้างบนได้ผลถูก (เก็บไฟล์ `.http` ไว้ใช้ตอนอัดวิดีโอ)

---

## Phase 4 — การจองของฉัน

- [ ] `GET /me/bookings` แยก "กำลังจะถึง" / "ที่ผ่านมา"
- [ ] `PUT /bookings/:id` ใช้ฟังก์ชันเดียวกับ Phase 3 โดยส่ง `excludeID = id`
  - [ ] เคส: ร้าน 10 ที่ · A จอง 7 · B จอง 3 → A แก้เป็น 8 ✕ · A แก้เป็น 5 ✓
  - [ ] เลยเวลายกเลิกแล้ว → ห้ามแก้
  - [ ] การจองที่ยกเลิกแล้ว → ห้ามแก้
- [ ] `POST /bookings/:id/cancel` ได้เมื่อ `now <= startAt − lead` → status `cancelled`, CancelledAt = now
- [ ] ทุก endpoint เช็ก `booking.UserID == userID`

**หน้าเว็บ**
- [ ] การ์ดต้นขั้ว (วันนี้ = ชาด · ปกติ = คราม · ยกเลิก = เทา จาง 72%)
- [ ] ปุ่มยกเลิก → แถบชมพูยืนยัน inline · เลยเวลา → disabled + ข้อความชาด
- [ ] แก้ไข: dialog (desktop) / bottom sheet (มือถือ) + seat dots ไม่นับที่เดิมซ้ำ

✅ **เสร็จเมื่อ:** เคส A 7→8 / 7→5 ถูกต้อง · ปุ่มยกเลิก disabled เมื่อเลยเวลา

---

## Phase 5 — รีวิว + การเรียง

- [ ] `GET /restaurants/:id/reviews`
- [ ] `PUT /restaurants/:id/reviews/me` upsert ด้วย `clause.OnConflict` บน (restaurant_id, user_id) · เจ้าของร้าน → 403 · rating 1–5
- [ ] ค่าเฉลี่ยใน query รายการร้าน:
  ```sql
  LEFT JOIN reviews ON reviews.restaurant_id = restaurants.id
  GROUP BY restaurants.id
  -- ROUND(AVG(reviews.rating)::numeric, 1) AS avg_rating, COUNT(reviews.id) AS review_count
  ```
- [ ] `sort=rating` → `ORDER BY (review_count >= 5) DESC, avg_rating DESC, review_count DESC`
- [ ] `sort=reviews` → `ORDER BY review_count DESC, avg_rating DESC`
- [ ] ค่าคงที่ `MinReviewsForRanking = 5` (เปลี่ยนที่เดียว)

**หน้าเว็บ**
- [ ] star picker · ป้าย "4 ดาว — ดีมาก" · ปุ่มโพสต์ disabled จนกว่าจะเลือกดาว
- [ ] เจ้าของเห็นกล่องล็อก "รีวิวร้านของตัวเองไม่ได้"
- [ ] หน้าการจองของฉัน: การ์ดที่ผ่านมามีปุ่ม "เขียนรีวิว" หรือป้าย "รีวิวแล้ว" (= เคยรีวิวร้านนั้นแล้ว)

✅ **เสร็จเมื่อ:** ร้าน 5.0 (1 รีวิว) อยู่ท้ายรายการเมื่อเรียงตามคะแนน

---

## Phase 6 — Dashboard เจ้าของร้าน

- [ ] `GET /restaurants/:id/bookings?date=` (เจ้าของเท่านั้น) → ลูกค้า / จำนวนคน / เวลา / สถานะ
- [ ] กราฟใช้ endpoint availability ตัวเดิม
- [ ] ตัวสลับร้าน · ปุ่ม "ดูหน้าร้าน", "แก้ไขร้าน", "สร้างร้านใหม่"
- [ ] แบนเนอร์ร้าน: คะแนนเฉลี่ย · ที่นั่ง · เวลาเปิด · ยกเลิกล่วงหน้า

---

## Phase 7 — Seed · Docker · README

**Seed**
- [ ] ร้าน 7 ร้านจาก [HANDOFF §7](design/HANDOFF.md)
- [ ] รีวิว: 1 คนรีวิวได้ครั้งเดียวต่อร้าน → 311 รีวิวต้องมี user ปลอม ~320 คน (หรือลดจำนวนใน seed)
- [ ] ครัวริมคลองใช้การกระจายดาวจากดีไซน์: 5★ 104 · 4★ 18 · 3★ 3 · 2★ 1 · 1★ 0 → เฉลี่ย 4.8
- [ ] การจองนับวันจาก **วันที่รัน seed** · มีเคสเต็มพอดี (ครัวริมคลอง 12:00–13:00 จอง 7 + 3 = 10) ไว้เดโม A 7→8
- [ ] บัญชีทดสอบ: มะลิ (เจ้าของ ข้าวต้มโต้รุ่งท่าน้ำ + กาแฟใต้ถุนบ้าน) + ลูกค้า 1 คนที่มีการจอง
- [ ] API รัน seed ตอนเริ่มถ้า DB ว่าง (`SEED_ON_START=true`)

**Docker**
- [ ] `api/Dockerfile` (multi-stage) · volume แยกสำหรับ `uploads`
- [ ] `web/Dockerfile` ใช้ `output: "standalone"` · `API_URL` ส่งเป็น **build arg** (rewrites ถูกฝังตอน build)
- [ ] compose ครบ `db` + `api` + `web` · `api` รอ `db` healthy

**README**
- [ ] วิธีรัน (Docker + แบบ dev) · บัญชีทดสอบ · รายการ env

**Responsive**
- [ ] Tailwind `md` (768) = tab bar ↔ header · `lg` (1024) = layout desktop · ช่วงกลาง grid ร้าน 2 คอลัมน์

✅ **เสร็จเมื่อ:** clone ลงเครื่องใหม่ → `docker compose up --build` → เห็นร้านและการจองทันที

---

## Phase 8 — วิดีโอ (≤ 5 นาที)

- [ ] ~3 นาที เดโมทุกฟีเจอร์ (สมัคร → สร้างร้าน → จอง → แก้ไข/ยกเลิก → รีวิว → dashboard)
- [ ] ~2 นาที เปิด `internal/booking/` อธิบาย lock + การวนเช็กทีละช่อง → ยิง `requests.http` ให้เห็นว่า Go ปฏิเสธ

## Checklist ส่งงาน

- [ ] Git repo (Next.js + Go) · README · บัญชีทดสอบ · ข้อมูลตัวอย่าง
- [ ] วิดีโอ ≤ 5 นาที
- [ ] ลิงก์ UI Design (canvas ใน HANDOFF)
- [ ] ส่งภายใน **11 ต.ค.**

---

## บันทึกการเปลี่ยนแปลง

แผนเปลี่ยนระหว่างเขียนเป็นเรื่องปกติ — จดไว้ตรงนี้ (ใช้ตอบคำถามในวิดีโอได้ด้วย)

- **แก้ทีหลังแพง** (ล็อกให้ดีใน Phase 1): schema โดยเฉพาะ StartAt/EndAt · วิธี auth · รูปแบบ error ของ API
- **แก้เมื่อไหร่ก็ได้:** เกณฑ์ < 5 รีวิว · กติกาแก้ไขหลังเลยเวลายกเลิก · breakpoint

| วันที่ | เปลี่ยนอะไร | เพราะอะไร |
|---|---|---|
| | | |

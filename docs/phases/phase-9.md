# Phase 9 — ตรวจความปลอดภัย + แก้ช่องโหว่

**ผลลัพธ์:** ปิดทุกข้อที่เจอจากการตรวจโค้ดและ dependency · ทดสอบซ้ำกับระบบจริง (Go + PostgreSQL + Next + Docker) · `requests.http` และ `race.sh` ได้ผลเหมือนเดิม · เลขบรรทัดที่อ้างในสคริปต์วิดีโอไม่ขยับ

## สิ่งที่เจอ และแก้ยังไง

| # | ระดับ | เจออะไร | แก้ | ไฟล์ |
|---|---|---|---|---|
| 1 | สูง | `used+party > r.Seats` คิดด้วย `int` ธรรมดา → ส่ง `partySize: 9223372036854775807` ผลบวกล้นเป็นค่าติดลบ ร้านเต็มก็จองผ่าน และหลังจากนั้นช่องนั้นรับกี่คนก็ได้ | เทียบ `party > r.Seats-used` (ไม่บวกเลขที่ลูกค้าส่งมา) | `api/internal/booking/service.go` บรรทัด 86 |
| 2 | กลาง | `callbackUrl=/\evil.com` (หรือ `/<tab>/evil.com`) ผ่านตัวกัน `//` แต่เบราว์เซอร์อ่านเป็น `//evil.com` → login เสร็จแล้วถูกพาไปเว็บอื่น | ให้ URL parser ตัดสินว่า origin เดียวกันไหม | `web/lib/require-session.ts` |
| 3 | กลาง | ชื่อที่แสดงไม่จำกัดความยาว (body ได้ 10MB) → ชื่อยาวหลาย MB ไปโผล่ในรายการรีวิวทุกหน้า | 1–100 ตัวอักษร (Go · zod · mock) | `handlers/auth.go` |
| 4 | กลาง | ไม่มี rate limit · จองล่วงหน้าได้ไม่จำกัด · จองได้ไม่จำกัดต่อคน · รูปที่อัปโหลดไม่เคยถูกลบ (ดิสก์เต็มได้) | rate limit ([ตาราง](../API.md#rate-limit)) · จองล่วงหน้า ≤ 60 วัน · การจองที่ยังไม่ถึงเวลา ≤ 30 รายการต่อคน · ลบรูปที่ไม่มีร้านใช้เมื่อเก่าเกิน 24 ชม. | `handlers/limits.go` · `routes.go` · `bookings.go` · `uploads.go` · `booking/limits.go` |
| 5 | กลาง (ยืนยันแล้วว่าเกิดจริง) | ลบร้าน: นับการจองแล้วลบโดยไม่ล็อก → การจองที่เข้ามาพร้อมกันได้ `201` แล้วถูกลบตามร้านเงียบ ๆ (ยิงพร้อมกันกับโค้ดเดิม: หาย 59 จาก 60 รอบ) | นับและลบใน transaction ที่ `FOR UPDATE` แถวร้าน แบบเดียวกับตอนจอง | `handlers/restaurants.go` · `handler.go` |
| 6 | กลาง ถ้าเปิด port ให้คนอื่น | `JWT_SECRET` ค่า default อยู่ใน repo → ใครก็ปลอม token เป็นผู้ใช้คนไหนก็ได้ · compose เปิด DB/API ทุก network interface · `SEED_ON_START=reset` เป็น default ทุกกรณี · container รันเป็น root | ไม่ตั้ง = สุ่มเก็บใน DB · ตั้งเองต้อง ≥ 32 ตัวอักษร · DB/API ผูก `127.0.0.1` · `reset` เป็น default เฉพาะ DB dev · รันเป็น user ธรรมดา · `AUTH_SECRET` สุ่มตอน container เริ่ม | `config.go` · `cmd/api/main.go` · `database.go` · `docker-compose.yml` · `Dockerfile` ทั้งสอง |
| 7 | ต่ำ | token ของ Go อยู่ใน session ที่ `useSession()` / `/api/auth/session` อ่านได้ · logout แล้ว token ยังใช้ได้ 7 วัน | BFF: `web/app/api/v1/[...path]/route.ts` แนบ token ให้ฝั่ง server · `ver` ใน token + `POST /auth/logout` | `web/auth.ts` · `middleware/auth.go` |
| 8 | ต่ำ | Swagger UI โหลด `swagger-ui-dist@5` จาก CDN ไม่ล็อกเวอร์ชัน ไม่มี integrity ทั้งที่หน้านั้นเก็บ token | ล็อก `5.33.1` + SRI (hash ตรงกับ tarball ของ npm) | `apidocs/index.html` |
| 9 | ต่ำ | `seats` / `cancelLeadMinutes` ไม่มีค่าสูงสุด (เวลายกเลิกมหาศาลทำ `time.Duration` ล้น) | ≤ 1,000 ที่ / ≤ 7 วัน | `handlers/restaurants.go` |
| 10 | dependency | image `node:22-alpine` มีช่องโหว่ high 11 ตัว (Trivy) อยู่ใน npm ที่ติดมากับ image ทั้งหมด · `source-map-js@1.2.1` | ลบ npm / yarn / corepack ออกจาก stage ที่รัน → 0 · `npm audit fix` → `1.2.2` | `web/Dockerfile` · `package-lock.json` |

`braces` (ผ่าน `eslint-config-next`) ยังขึ้นใน `npm audit` — ใช้แค่ตอน lint ไม่มีเวอร์ชันที่แก้แล้ว และ `npm audit fix --force` จะลด `eslint-config-next` เป็น 14 จึงไม่ทำ

## การตัดสินใจ และเหตุผล

| เรื่อง | เลือก | ทำไม | ทางอื่นที่ไม่เลือก |
|---|---|---|---|
| แก้ overflow | เขียนเงื่อนไขใหม่ในบรรทัดเดิม `party > r.Seats-used` | ยังตอบ `409 SEATS_EXCEEDED` พร้อม `details` เหมือนเดิม (หน้าเว็บ / `requests.http` ไม่ต้องแก้) · ความหมายเดียวกับ `จองแล้ว + คนที่ขอ ≤ ที่นั่ง` · ไม่มีบรรทัดไหนขยับ | เช็ก `partySize ≤ seats` ใน `Validate`: เปลี่ยน error เป็น `400 VALIDATION` ทั้งที่ TASKS ตกลงไว้ว่า 409 |
| rate limit login | นับเฉพาะครั้งที่ผิด ต่ออีเมล | login จากหน้าเว็บผ่าน server ของ Next ทั้งหมด → IP เดียวกัน · login ถูกไม่นับ → เดโม / `race.sh` login ซ้ำได้ไม่ติด | ต่อ IP: ทุกคนแชร์โควตาเดียว และ `X-Forwarded-For` ปลอมได้ (Next ไม่เขียนทับค่าที่ client ส่งมา) |
| rate limit สมัคร | ต่อ IP (best effort) + เพดานรวมทั้งระบบ | ยังไม่มีบัญชีให้ผูก · IP ปลอมได้จึงต้องมีเพดานรวม | captcha / ยืนยันอีเมล: เกินขอบเขตงาน |
| เพดานการจองต่อคน | เช็กที่ handler · ล็อกแถว user ใน transaction เดียวกับการจอง | เป็นกติกากันใช้งานในทางผิด ไม่ใช่กติกาการจองหลัก · seed เรียก `booking.Create` ตรงจึงไม่โดน · ล็อกแถว user → ยิงพร้อมกันก็ไม่หลุดเพดาน | ใส่ใน `booking.Create`: โค้ดที่อธิบายในวิดีโอเปลี่ยน และ seed (สมชายมี 11 รายการ) ต้องอ้อม |
| เก็บ token ของ Go | ใน session cookie (httpOnly) · route ของ Next แนบให้ (BFF) | มี XSS ก็ขโมย token ไปใช้ที่อื่นไม่ได้ | rewrite + หน้าเว็บแนบ Bearer เอง (เดิม): JavaScript อ่าน token ได้ |
| กัน CSRF | cookie `SameSite=Lax` + คำขอที่เปลี่ยนข้อมูลต้องมี `Sec-Fetch-Site: same-origin` (ถ้าเบราว์เซอร์ส่งมา) | พอใช้ cookie ยืนยันตัวตนแล้วต้องกัน CSRF · header นี้เบราว์เซอร์ใส่เอง เว็บอื่นปลอมไม่ได้ · ไม่ต้องแก้ทุกฟอร์ม | CSRF token: ต้องส่งทุก fetch |
| ยกเลิก token ตอน logout | เลขเวอร์ชันในตาราง users (`token_version`) | ถาม DB แถวเดียวต่อคำขอ · ไม่ต้องเก็บรายการ token · token เก่าที่ไม่มี `ver` (= 0) ยังใช้ได้ ไม่มีใครหลุด login ตอนอัปเดต | denylist ตาม jti: ต้องเก็บ + ลบรายการที่หมดอายุ · ผลข้างเคียงของแบบที่เลือก: logout = ออกทุกเครื่อง |
| กุญแจ JWT ตอนไม่ตั้ง env | สุ่มครั้งแรกแล้วเก็บในตาราง `app_secrets` (reset ไม่ลบ) | ไม่มีค่าที่ใครก็รู้ · restart / reseed แล้ว login เดิมยังใช้ได้ตามที่ README บอก | สุ่มใหม่ทุกครั้งที่เริ่ม: restart แล้วทุกคนหลุด login · บังคับตั้ง env: `docker compose up` แบบไม่มี `.env` ใช้ไม่ได้ |
| `SEED_ON_START` default | `reset` เฉพาะตอนไม่ได้ตั้ง `DATABASE_URL` (DB dev) | `go run ./cmd/api` ใช้เหมือนเดิม · ชี้ DB อื่นแล้วไม่ล้างข้อมูลเองโดยไม่ตั้งใจ | `false` ทุกกรณี: ขั้นตอน dev / present เปลี่ยน |
| volume รูปใน Docker | ชื่อใหม่ `uploads-data` | volume เดิมเป็นของ root แต่ api รันเป็น uid 10001 แล้ว → เขียนไม่ได้ · volume ใหม่ Docker สร้างตามเจ้าของโฟลเดอร์ใน image | entrypoint ที่ chown แล้วลดสิทธิ์: ซับซ้อนกว่า |
| error ของเรากับ middleware ของ Fiber | `apperr.Error` มี method `As` แปลงเป็น `*fiber.Error` | limiter ดู status จาก `*fiber.Error` เท่านั้น · ไม่มี = login ผิดถูกนับเป็นสำเร็จ (status เขียนลง response ทีหลัง) | ตั้ง `c.Status()` ก่อน return ทุก handler: ลืมง่าย |

## ทดสอบยังไง (6 ต.ค. 2569)

สคริปต์ทดสอบไม่ได้เก็บใน repo (ตกลงไว้ว่าไม่มี backend test) · ทดสอบซ้ำเองได้ด้วยหมวด "Phase 9" ใน `api/requests.http` และ `bash api/scripts/race.sh`

- Go: `go vet` · staticcheck 2026.2.1 · govulncheck ไม่เจอช่องโหว่ที่โค้ดเรียกถึง
- ยิง Go จริง + PostgreSQL 31 ข้อผ่านหมด: overflow · ขอบ 60/61 วัน · ชื่อ 100/101 · ที่นั่ง 1,000/1,001 · เพดาน 30 รายการ · logout · rate limit ทุกกลุ่ม
- `requests.http` ทั้งไฟล์ได้ผลตาม "คาดหวัง" ทุกข้อ · `race.sh` ทุกรอบได้ 201 หนึ่งคน + 409 หนึ่งคน
- ยิงจองกับลบร้านพร้อมกัน: โค้ดเดิมการจองหาย 59/60 รอบ · โค้ดใหม่ 0/30
- ผ่าน Next (BFF) 28 ข้อ + เบราว์เซอร์จริง (login → จอง → logout) ผ่านทั้งแบบ `node server.js` และใน Docker · `npm run dev:mock` ใช้ได้
- Docker: api รันเป็น uid 10001 · web เป็น uid 1000 · Trivy สแกน image ที่ build ได้ high/critical 0 ทั้งคู่

ระหว่างทดสอบเจอบั๊กเดิมที่ไม่เกี่ยวกับความปลอดภัย: seed ของ mock ล่มช่วงเที่ยงถึงบ่ายโมง (ยกเลิกการจองวันนี้ที่เลยเวลายกเลิกแล้วโดยไม่ดัก error) → `npm run dev:mock` ตอบ 500 ทุก request · แก้ให้ข้ามแบบเดียวกับ Go (`web/mock/seed.ts`)

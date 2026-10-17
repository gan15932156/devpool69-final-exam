# ตึกตึกโต๊ะ — ระบบจองโต๊ะร้านอาหาร + รีวิวร้าน

DevPool Final Exam 2569 · หน้าเว็บ **Next.js** · API **Go** · ฐานข้อมูล **PostgreSQL**

- จองโต๊ะโดยระบุ จำนวนคน · วันที่ · เวลาเริ่ม–สิ้นสุด → Go ตรวจเวลาเปิดร้าน, เวลาที่ผ่านไปแล้ว และที่นั่งรวม **ทีละช่วง 30 นาที** ใน transaction ที่ล็อกแถวร้าน (กันสองคนจองที่นั่งสุดท้ายพร้อมกัน)
- บัญชีเดียวเป็นได้ทั้งเจ้าของร้าน (ร้านที่ตัวเองสร้าง) และลูกค้า/ผู้รีวิว (ร้านของคนอื่น)
- รองรับร้านเปิดข้ามเที่ยงคืน (เช่น 18:00–02:00) · แก้ไขการจองโดยไม่นับที่นั่งเดิมซ้ำ · รีวิว 1–5 ดาว (รีวิวร้านตัวเองไม่ได้)

**ดีไซน์ (canvas):** https://claude.ai/artifact/GhwP3FfMxLiqvCzk9yJfE1

---

## เริ่มใช้งาน (Docker) — แนะนำ

ต้องมี Docker (Docker Desktop / Rancher Desktop แบบ dockerd)

```bash
git clone <repo-url> toawang
cd toawang
docker compose up --build
```

เปิด **http://localhost:3000** · API สร้างตารางและใส่ข้อมูลตัวอย่างให้เอง (ร้าน 20 ร้าน · รีวิว 1,572 รายการ · การจอง ~1,200 รายการ นับจากเวลาที่เปิดระบบ)

| บริการ | ที่อยู่ |
|---|---|
| เว็บ | http://localhost:3000 |
| Go API | http://localhost:8080/api/v1/health (เปิดให้เครื่องนี้เท่านั้น) |
| API docs (Swagger UI) | http://localhost:8080/docs |
| PostgreSQL | `localhost:5433` (user / pass / db = `toawang` · เปิดให้เครื่องนี้เท่านั้น) |

**Docker seed ข้อมูลตัวอย่างครั้งเดียวตอน DB ว่าง** (`SEED_ON_START=true`): ข้อมูลที่สร้างระหว่างทดสอบอยู่รอดข้าม restart · การจองตัวอย่างนับจากเวลาที่ seed ครั้งแรก ทิ้งไว้นานจนการจองวันนี้ผ่านไปแล้ว → ล้างแล้ว seed ใหม่ด้วย `$env:SEED_ON_START="reset"; docker compose up -d api` (รอบถัดไปสั่ง `docker compose up -d api` เฉย ๆ เพื่อกลับเป็น `true`) · seed สร้างผู้ใช้ลำดับเดิม id เดิมทุกครั้ง และกุญแจ JWT เก็บในตารางที่ไม่ถูกล้าง จึงล็อกอินค้างไว้ได้แม้ seed ใหม่ · container `web` เริ่มใหม่ (restart หรือ `up --build`) ต้อง login ใหม่ เพราะ `AUTH_SECRET` สุ่มใหม่ (ตั้งค่าเองใน `.env` ได้)

## บัญชีทดสอบ

2 บัญชีนี้เตรียมข้อมูลไว้ครบสำหรับทดสอบ/เดโม · รหัสผ่าน **`123456`** · บัญชีอื่นทั้งหมด (`nid@example.com`, `reviewer001@example.com` …) รหัส **`toawang123`**

| อีเมล | ข้อมูลที่เตรียมไว้ |
|---|---|
| `usr2@email.com` (สมชาย · **ลูกค้า**) | การจองที่กำลังจะถึง 11 รายการ (วันนี้ · ร้านข้ามเที่ยงคืน · ถึงอีก 7 วัน) · 1 รายการ**เลยเวลายกเลิกแล้ว** (ปุ่มแก้/ยกเลิกกดไม่ได้ — มีเมื่อ API เริ่มช่วงราว 10:00–21:30 · อยู่ในแท็บ "กำลังจะถึง" ราว 2 ชม. ครึ่งหลังเริ่ม) · ที่ผ่านมา 8 (รีวิวแล้ว 5 · รอเขียนรีวิว 3) · ยกเลิกแล้ว 3 · **พรุ่งนี้ครัวริมคลอง 12:00–13:00 จอง 7 คน ร้านเต็มพอดี 10 ที่ → ลองแก้เป็น 8 (ไม่ผ่าน) / 5 (ผ่าน)** |
| `usr1@email.com` (มะลิ · **เจ้าของ + ลูกค้า**) | เจ้าของ 3 ร้าน: ข้าวต้มโต้รุ่งท่าน้ำ (18:00–02:00 มีการจองหลังเที่ยงคืน) · กาแฟใต้ถุนบ้าน · ขนมไทยแม่มะลิ (รีวิวยังน้อย) → dashboard มีการจองทุกวัน · เปิดหน้าร้านตัวเองเห็นกล่อง "รีวิวร้านของตัวเองไม่ได้" · เป็นลูกค้าร้านอื่นด้วย (การจอง 4 · ที่ผ่านมา 5 · ยกเลิก 1) |

บัญชีอื่น (`nid@`, `somsak@`, `reviewer001@` … `@example.com`) เป็นเจ้าของร้าน/ผู้รีวิวในข้อมูลตัวอย่าง

## รันแบบ dev (แก้โค้ดแล้วเห็นผลทันที)

ต้องมี Go 1.25+ (Go ดาวน์โหลด toolchain ที่ `go.mod` ต้องการให้เอง) และ Node.js 20.9+

```bash
docker compose up -d db              # เปิดแค่ฐานข้อมูล

cd api
go run ./cmd/api                     # http://localhost:8080 · ล้างแล้ว seed ใหม่ทุกครั้งที่รัน

cd web
cp .env.example .env.local           # แล้วใส่ AUTH_SECRET (คำสั่งสร้างค่าสุ่มอยู่ในไฟล์)
npm install
npm run dev                          # http://localhost:3000
```

> ถ้าเปิดทั้ง Docker ครบชุดอยู่ ต้อง `docker compose stop api web` ก่อน เพราะพอร์ต 8080/3000 จะชนกัน

### รันหน้าเว็บอย่างเดียวด้วย mock API (ไม่ต้องเปิด Go / PostgreSQL)

```bash
cd web
npm install
npm run dev:mock                     # http://localhost:3000 (เปลี่ยนพอร์ต: PORT=3001 npm run dev:mock)
```

- ใช้ข้อมูลชุดเดียวกับ seed ของ Go (20 ร้าน · รีวิว · การจองนับจากเวลาที่เริ่ม) และ**บัญชีทดสอบเดิม** (`usr2@email.com` / `usr1@email.com` รหัส `123456` · บัญชีอื่นรหัส `toawang123`)
- จอง · แก้ไข · ยกเลิก · รีวิว · สร้าง/แก้/ลบร้าน · อัปโหลดรูป ใช้ได้หมด ด้วยกติกาและ error code เดียวกับ Go (`web/mock/booking.ts` แปลงมาจาก `api/internal/booking`)
- ข้อมูลอยู่ในหน่วยความจำ → ปิด/เปิด dev server ใหม่ = เริ่มจากข้อมูลตัวอย่างใหม่ · แก้โค้ดแล้ว hot reload ข้อมูลไม่หาย
- สลับระหว่าง mock กับ Go จริงแล้วเว็บจะพาไปหน้า login ใหม่ (token ของสองฝั่งใช้แทนกันไม่ได้)
- เป็นแค่ตัวช่วยทดสอบหน้าเว็บ — กติกาจริงอยู่ที่ Go · แก้กติกาใน `api/internal/booking` แล้วต้องแก้ `web/mock/booking.ts` ตามด้วย

## Environment variables

| ตัวแปร | ใช้ที่ | ค่า default | ความหมาย |
|---|---|---|---|
| `DATABASE_URL` | api | `postgres://toawang:toawang@localhost:5433/toawang?sslmode=disable` | ที่อยู่ PostgreSQL |
| `JWT_SECRET` | api | — (สุ่มเก็บใน DB) | กุญแจเซ็น JWT (HS256) · ถ้าตั้งต้องยาวอย่างน้อย 32 ตัวอักษร · ไม่ตั้ง = API สุ่มครั้งแรกแล้วเก็บในตาราง `app_secrets` |
| `PORT` | api | `8080` | พอร์ตของ Go |
| `UPLOAD_DIR` | api | `uploads` | โฟลเดอร์เก็บรูปที่อัปโหลด |
| `SEED_ON_START` | api | `reset` ถ้าไม่ได้ตั้ง `DATABASE_URL` · ไม่งั้น `false` | `reset` = ล้างทุกตารางแล้ว seed ใหม่ทุกครั้งที่เริ่ม · `true` = seed เฉพาะตอน DB ว่าง (เก็บข้อมูลที่ทดสอบไว้) · `false` = ไม่ seed · ชี้ไป DB อื่นแล้วไม่มีการล้างข้อมูลเอง ต้องสั่งเอง |
| `API_URL` | web | `http://localhost:8080` | ที่อยู่ Go สำหรับ `/api/v1/*` (route ของ Next ที่แนบ token) · rewrite รูป · NextAuth (ฝั่ง server ทั้งหมด) |
| `AUTH_SECRET` | web | — (Docker สุ่มให้ตอนเริ่ม) | กุญแจเข้ารหัส session cookie ของ NextAuth |
| `AUTH_TRUST_HOST` | web | `true` | ให้ NextAuth เชื่อ Host header (จำเป็นเมื่อรันหลัง Docker/proxy) |
| `AUTH_URL` | web | `http://localhost:3000` (Docker) | ที่อยู่ที่เบราว์เซอร์เปิด ใช้ตอน redirect หลัง logout |

ไม่มีไฟล์ `.env` ก็รันได้ · อยากกำหนดค่าลับเองสำหรับ Docker ใส่ในไฟล์ `.env` ที่ root (ดู `.env.example`)

## ความปลอดภัย

| เรื่อง | ทำอะไรไว้ |
|---|---|
| ตรวจที่นั่ง | เทียบ `partySize > seats − used` แทน `used + partySize > seats` → ส่งจำนวนคนมหาศาล (เช่น `9223372036854775807`) ก็ไม่ล้น int จนจองเกินได้ |
| ใช้งานในทางผิด | rate limit (login ผิดต่ออีเมล · สมัครต่อ IP · การเขียนต่อบัญชี) · จองล่วงหน้าได้ไม่เกิน 60 วัน · การจองที่ยังไม่ถึงเวลาไม่เกิน 30 รายการต่อคน · จำกัดความยาวชื่อ/ที่นั่ง/เวลายกเลิก · ลบรูปที่ไม่มีร้านใช้ ([รายละเอียด](docs/API.md#rate-limit)) |
| Token | หน้าเว็บอ่าน token ของ Go ไม่ได้ (อยู่ใน cookie httpOnly · `web/app/api/v1/[...path]/route.ts` แนบให้ฝั่ง server และกัน CSRF ด้วย `Sec-Fetch-Site`) · logout แล้ว token เดิมใช้ไม่ได้ทันที |
| ค่าลับ | ไม่มีค่า default ที่เขียนไว้ใน repo · ไม่ตั้ง `JWT_SECRET` = สุ่มเก็บใน DB · `AUTH_SECRET` ใน Docker สุ่มตอนเริ่ม |
| Redirect หลัง login | `callbackUrl` ต้องเป็น path ในเว็บเรา ตรวจด้วย URL parser (กัน `/\evil.com`) |
| Docker | container รันเป็น user ธรรมดา · DB และ API เปิดให้เครื่องนี้เท่านั้น · Swagger UI ล็อกเวอร์ชันพร้อม integrity hash |

> โหมด `SEED_ON_START=reset` สร้างตาราง users ใหม่ทุกครั้ง → token ที่ logout ไปแล้วก่อน restart กลับมาใช้ได้ถ้ายังไม่หมดอายุ · ใช้โหมดนี้กับข้อมูลเดโมเท่านั้น

## ทดสอบกติกาการจอง

- **`cd api && go test ./...`** — unit test + integration test ของ API · integration test ใช้ Postgres ตัวเดียวกับ dev (`docker compose up -d db`) แต่สร้าง database แยก `toawang_test_*` ไม่แตะข้อมูล dev · ไม่ได้เปิด DB = ข้ามเฉพาะ test ที่ต้องใช้ DB · ชี้ไป Postgres อื่นได้ด้วย `TEST_DATABASE_URL`
- **`cd web && npm test`** — test ของหน้าเว็บ (Vitest) ไม่ต้องเปิด Go/Next: ตัวช่วยใบจอง · schema ฟอร์ม · ด่านของ `/api/v1/*` (แนบ token · กัน CSRF · กัน `..`) · mock API ให้ผลเหมือน Go · component ใบจอง/การ์ดการจอง/login
- **`api/requests.http`** — เปิดใน VS Code ติดตั้ง extension *REST Client* แล้วกด "Send Request" ไล่ลงมา · ทุก request มีบรรทัด "คาดหวัง:" บอกผลที่ต้องได้ (นอกเวลาเปิด · เวลาที่ผ่านไปแล้ว · ที่นั่งเกิน · ร้านข้ามเที่ยงคืน · แก้ไข 7→8 / 7→5 · สิทธิ์เจ้าของ ฯลฯ)
- **`bash api/scripts/race.sh`** (Git Bash) — สองคนจองที่นั่งสุดท้ายพร้อมกัน 5 รอบ → ทุกรอบต้องได้ 201 หนึ่งคน + 409 หนึ่งคน

## โครงสร้างโปรเจกต์

```
api/                         Go · Fiber v3 · GORM
├── cmd/api/                 จุดเริ่มโปรแกรม
├── cmd/seed/                ใส่ข้อมูลตัวอย่าง
└── internal/
    ├── booking/             ★ กติกาการจองทั้งหมด (แปลงเวลา · ตรวจ · lock · ตรวจที่นั่งทีละช่อง)
    ├── handlers/            HTTP endpoints
    ├── middleware/          ตรวจ JWT + เวอร์ชัน token (logout แล้วใช้ไม่ได้)
    ├── models/              ตาราง
    ├── apperr/              รูปแบบ error กลาง { error: { code, message, details } }
    ├── apidocs/             Swagger UI ที่ /docs + openapi.yaml
    └── seed/                ข้อมูลตัวอย่าง + รูป
web/                         Next.js 16 · Tailwind v4 · NextAuth v5 · TanStack Query
├── app/(auth)/              เข้าสู่ระบบ · สมัคร
├── app/(main)/              ค้นหาร้าน · หน้าร้าน · การจองของฉัน · ร้านของฉัน · ฟอร์มร้าน
├── app/api/v1/              ส่งต่อคำขอไป Go พร้อมแนบ token จาก session cookie (ฝั่ง server)
├── components/              booking/ · restaurant/ · review/ · layout/ · ui/
└── lib/                     เรียก API · คำนวณใบจองฝั่งหน้าเว็บ · schema ฟอร์ม
docs/
├── phases/                  สรุปแต่ละ phase: ทำอะไร ทำไม เลือกอะไร
├── design/                  design handoff + tokens + assets
├── API.md                   ★ API reference ของ Go ทุก endpoint + error code
└── WALKTHROUGH.md           แผนพัฒนาและข้อตกลง
```

## การตัดสินใจหลัก

| เรื่อง | ตัดสินใจ |
|---|---|
| กันจองพร้อมกัน | transaction + `SELECT … FOR UPDATE` ที่แถวร้าน |
| นับที่นั่ง | วนทีละช่อง 30 นาที · เวลาจองต้องลงที่ :00/:30 (บังคับที่ Go) |
| ร้านข้ามเที่ยงคืน | เวลาปิด ≤ เวลาเปิด = ปิดวันถัดไป · เก็บเวลาจองเป็น `timestamptz` + `service_date` ของรอบ |
| แก้ไขหลังเลยเวลายกเลิก | ไม่ได้ |
| รีวิว | 1 คน 1 ร้าน (แก้ได้) · ไม่ต้องเคยจอง · ค่าเฉลี่ยคำนวณสด |
| เรียงตามคะแนน | ร้านที่รีวิวน้อยกว่า 5 ไปท้าย + ป้าย "รีวิวยังน้อย" |
| Auth | Go ตรวจรหัส (bcrypt) และเซ็น JWT · NextAuth ถือ token ไว้ใน session cookie (httpOnly) · route `/api/v1/*` ของ Next แนบ token ให้ · logout ยกเลิก token ที่ Go |

รายละเอียดเหตุผลทุกข้อ: [docs/phases/](docs/phases/README.md)

> รูปร้านในข้อมูลตัวอย่างเป็นภาพประกอบที่สร้างขึ้น (`api/internal/seed/images/`) · เปลี่ยนเป็นรูปจริงได้โดยวางไฟล์ชื่อเดิมทับ (jpg/png/webp) แล้ว seed ใหม่

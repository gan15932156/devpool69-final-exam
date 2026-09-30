# โต๊ะว่าง — Task Breakdown ตาม Phase

แตกจาก [WALKTHROUGH.md](WALKTHROUGH.md) (แผน) + [design/HANDOFF.md](design/HANDOFF.md) (ดีไซน์) เป็น ticket ที่ทำทีละใบได้ · อัปเดตสถานะด้วยการติ๊ก `[ ]` หน้า ID

**ป้ายกำกับ:** `[F]` เจอในเอกสาร/ไฟล์ตรง ๆ · `[I]` อนุมานจาก Fact · `[A]` สมมติฐาน (ยังไม่มีข้อสรุป ต้องยืนยัน)

---

## 0. อ่านก่อน

### ปรับกติกาให้เข้ากับงานนี้
| กติกาทั่วไป | งานนี้ใช้ | เหตุผล |
|---|---|---|
| ticket ละ 1–8 person-day | ticket ละ **0.5–5 ชม.** | ทำคนเดียว 17 วัน `[F]` ticket ขนาดวันจะหยาบเกินจนติดตามไม่ได้ |
| 1 ticket = 1 PR | 1 ticket = **1 commit** (revert ได้ด้วย `git revert <sha>`) | ทำคนเดียว ไม่มีคนรีวิว PR `[I]` |
| ticket แกนกลางต้องมี test ก่อน | ใช้ **`api/requests.http`** เป็นตัวตรวจแทน | ตกลงไว้แล้วว่า "ไม่มี backend test" `[F]` WALKTHROUGH บรรทัด 12 |

### หลักฐานที่ใช้ (รันซ้ำได้)
```bash
# ยังไม่มีโค้ด — ทุก ticket เริ่มจากศูนย์
find . -type f -not -path "./docs/*"          # → ว่าง [F]
git status                                    # → not a git repository [F]

# ขนาดไฟล์ reference ที่ต้องเปิดดูตอนทำ UI
wc -l docs/design/reference/*/*.dc.html       # → 16 ไฟล์ รวม 2,999 บรรทัด [F]
grep -n "renderVals" docs/design/reference/*/*.dc.html   # logic UI ของแต่ละหน้า [F]
grep -o "\-\-color-[a-z0-9-]*" docs/design/tokens/tokens.css | sort -u | wc -l   # → 22 สี [F]
```

### งบเวลา
สมมติทำได้ **~7 ชม./วัน** `[A — ไม่มีข้อมูลว่าแต่ละวันว่างกี่ชม. ต้องปรับเอง]`

| Phase | วันที่ | ชม. ที่มี | ชม. ประเมิน | ส่วนต่าง |
|---|---|---|---|---|
| 0 ตั้งโปรเจกต์ | 25 ก.ย. | 7 | 7 | 0 |
| 1 Models + Auth | 26–27 | 14 | 18 | **−4** ⚠️ |
| 2 ร้าน | 28–29 | 14 | 18.5 | **−4.5** ⚠️ |
| 3 การจอง | 30 ก.ย.–2 ต.ค. | 21 | 18 | +3 |
| 4 การจองของฉัน | 3–4 | 14 | 13.5 | +0.5 |
| 5 รีวิว + เรียง | 5–6 | 14 | 9.5 | +4.5 |
| 6 Dashboard | 7 | 7 | 5 | +2 |
| 7 Seed · Docker · README | 8–9 | 14 | 13.5 | +0.5 |
| 8 วิดีโอ + ส่ง | 10–11 | 14 | 5 | +9 |
| **รวม** | | **119** | **108** | **+11** |

`[I]` Phase 1–2 ใช้เวลาเกินช่องของตัวเองรวม ~8.5 ชม. แต่ Phase 3, 5, 6 มีเวลาเหลือพอชดเชย → **ปล่อยให้ตารางเลื่อนได้ แต่ห้ามเลื่อนจุด Checkpoint 2 (จบ Phase 3) เกิน 3 ต.ค.** เพราะเป็นแกนหลักที่ต้องอธิบายในวิดีโอ

### Critical path
```
P0-02 db ─┐
P0-03 go ─┴► P0-04 health ► P1-01 models ► P1-03 register/login ► P1-04 JWT mw
                                  │                                    │
                                  │           ┌────────────────────────┘
                                  ▼           ▼
                             P3-01 time ► P3-02 validate ► P3-03 seat tx ► P3-05 POST ► P4-02 PUT
                                                                   │
P0-05 next ► P0-06 tokens ► P1-09 ui ─► P2-04 ui ─► P2-06 หน้าร้าน ─┴► P3-08 ใบจอง ► P4-07 แก้ไข
```
ticket ที่ **Depends on = `—`** เริ่มได้ทันทีหรือทำคู่ขนานได้

### ใครทำอะไร

ชั่วโมงในตาราง ticket = เวลาถ้าเขียนโค้ดเองทั้งหมด · ถ้าให้ Claude เขียนโค้ด งานที่เหลือให้คุณคือหัวข้อ **"งานของคุณ"** ท้ายแต่ละ phase (รวม ~22 ชม.)

| Claude ทำ | คุณต้องทำเอง |
|---|---|
| เขียนโค้ดทุก ticket · รัน `go build` / `npm run build` / `curl` / `grep` ตาม DoD · commit | ตัดสินใจ (D1–D8, บัญชีทดสอบ) · เปิดโปรแกรม / สร้างบัญชีภายนอก · **ลองใช้ในเบราว์เซอร์และเทียบกับ canvas** · **อ่านโค้ดการจองจนอธิบายเองได้** · หารูป seed · อัดวิดีโอ · ส่งงาน |

**เช็กเครื่องแล้ว (25 ก.ย.)** — `go version`, `node -v`, `docker version`, `git --version`, `gh --version`
| เครื่องมือ | สถานะ |
|---|---|
| Go 1.25.6 · Node 22.14.0 · npm 11.14 · Git 2.48 | ✓ ใช้ได้ (Next.js 16 ต้องการ Node ≥ 20.9) `[F]` |
| Docker | ✗ daemon ไม่รัน → เปิด Rancher Desktop `[F]` |
| GitHub CLI (`gh`) | ✗ ไม่มี → สร้าง repo ผ่านเว็บ github.com ได้ ไม่ต้องติดตั้ง `[F]` |

**รอบการทำงานแต่ละ ticket**
1. บอก Claude: `ทำ ticket P?-?? ใน docs/TASKS.md`
2. Claude เขียน + ตรวจ DoD ส่วนที่รันคำสั่งได้ → รายงานผล
3. **คุณ** ตรวจ DoD ส่วนที่ต้องใช้ตา/มือ (หน้าตา, คลิกจริง) → ผ่านแล้วบอกให้ commit
4. ถ้าแผนเปลี่ยน → จดใน "บันทึกการเปลี่ยนแปลง" ท้ายไฟล์ (ใช้ตอบกรรมการได้)

**สิ่งที่ Claude ต้องได้จากคุณก่อนถึง ticket นั้น**
| ต้องการ | ภายใน | ใช้ใน |
|---|---|---|
| คำตอบ D1–D8 (หรือ "ใช้ค่าเริ่มต้น") | ก่อนเริ่ม Phase 1 | หลาย ticket |
| ชื่อ / อีเมล / รหัสผ่านบัญชีทดสอบ (มะลิ + ลูกค้า 1 คน) | 26 ก.ย. | P1-05, P7-01, README |
| รูปอาหาร 2–3 รูป × 7 ร้าน ใส่ `api/seed/images/<ชื่อร้าน>/` | 7 ต.ค. | P7-01 |
| URL GitHub repo เปล่า | 10 ต.ค. | P8-04 |

---

## 1. ต้องตัดสินใจก่อนเริ่ม ticket ที่เกี่ยวข้อง

ข้อ [ต้องคุย] ใน HANDOFF §6 ตัดสินครบแล้ว `[F]` ข้างล่างคือเรื่องที่ **ยังไม่มีในเอกสารไหน** — ใส่ค่าเริ่มต้นไว้ให้ ถ้าไม่เปลี่ยนก็ใช้ตามนี้

| # | เรื่อง | ค่าเริ่มต้น `[A]` | บล็อก ticket |
|---|---|---|---|
| D1 | "กำลังจะถึง" vs "ที่ผ่านมา" แบ่งด้วยอะไร | `endAt > now` = กำลังจะถึง (รวมที่ยกเลิกแล้วแต่ยังไม่ถึงเวลา แสดงแบบจาง) · `endAt <= now` = ที่ผ่านมา | P4-01, P4-05 |
| D2 | availability ต้อง login ไหม | ไม่ต้อง (ดูหน้าร้านได้ก่อน login) · `excludeBookingId` ใช้ได้เฉพาะการจองของตัวเอง ไม่ใช่ของตัวเองให้เพิกเฉย | P3-04 |
| D3 | ช่องค้นหา `q` ค้นจากอะไร | `name` + `cuisine` ด้วย `ILIKE` | P2-03 |
| D4 | ดูการจองของคนอื่น → 403 หรือ 404 | 403 `FORBIDDEN` (ตรงกับร้าน) | P4-02, P4-03 |
| D5 | ข้อความรีวิวบังคับไหม / ยาวสุด | ไม่บังคับ · ≤ 1,000 ตัวอักษร | P5-01 |
| D6 | การจองเดโมใน seed ลงวันไหน | วันถัดจากวันที่รัน seed (ต้องเป็นอนาคต ไม่งั้นแก้/ยกเลิกไม่ได้) | P7-01 |
| D7 | Git remote | GitHub public repo | P8-04 |
| D8 | ค่าเรียงเริ่มต้นหน้าค้นหา | `sort=rating` | P5-02 |

---

## 2. Error code กลาง (ล็อกใน P1-02)

WALKTHROUGH ระบุว่ารูปแบบ error "แก้ทีหลังแพง" `[F]` บรรทัด 311 → ตกลงรายการ code ตั้งแต่ Phase 1

| HTTP | code | ใช้เมื่อ |
|---|---|---|
| 400 | `VALIDATION` | body/query ผิดรูปแบบ · `details` = `{ field: message }` |
| 400 | `INVALID_SLOT` | เวลาไม่ลง :00/:30 |
| 400 | `INVALID_RANGE` | end ≤ start |
| 400 | `OUTSIDE_HOURS` | อยู่นอกเวลาเปิดร้าน |
| 400 | `IN_PAST` | เวลาเริ่มผ่านไปแล้ว |
| 400 | `UNSUPPORTED_FILE` | ไฟล์อัปโหลดไม่ใช่ jpg/png/webp หรือเกิน 5MB |
| 401 | `UNAUTHORIZED` | ไม่มี/token ผิด/หมดอายุ · login ผิด (ข้อความเดียวกัน) |
| 403 | `FORBIDDEN` | ไม่ใช่เจ้าของร้าน/การจอง |
| 403 | `OWN_RESTAURANT` | รีวิวร้านตัวเอง |
| 404 | `NOT_FOUND` | ไม่มี resource / route |
| 409 | `EMAIL_TAKEN` | สมัครด้วยอีเมลซ้ำ |
| 409 | `SEATS_EXCEEDED` | ที่นั่งไม่พอ · `details` = `{ slotStart, slotEnd, used, party, seats }` |
| 409 | `CANCEL_WINDOW_PASSED` | ยกเลิก/แก้ไขหลังเลยเวลา |
| 409 | `BOOKING_CANCELLED` | แก้/ยกเลิกการจองที่ยกเลิกไปแล้ว |
| 409 | `HAS_FUTURE_BOOKINGS` | ลบร้านที่ยังมีการจองในอนาคต |
| 500 | `INTERNAL` | อื่น ๆ (ไม่ส่ง error ภายในออกไป) |

---

## Phase 0 — ตั้งโปรเจกต์ · 25 ก.ย. · 7 ชม.

| ✓ | ID | งาน · ไฟล์ที่แตะ | ชม. | Depends | DoD (ผ่านเมื่อ) |
|---|---|---|---|---|---|
| [ ] | P0-01 | git init · `.gitignore` · `README.md` (หัวข้อเปล่า) | 0.5 | — | `git status` หลัง `npm install` ไม่เห็น `node_modules`, `.next`, `.env*`, `api/uploads/*`, `api/tmp` · มี commit แรก |
| [ ] | P0-02 | `docker-compose.yml` service `db` (`postgres:16-alpine`) + healthcheck `pg_isready` + named volume | 0.5 | Rancher Desktop เปิดแล้ว | `docker compose up -d db` แล้ว `docker compose ps` ขึ้น `healthy` · `docker compose exec db psql -U <user> -c "select 1"` ได้ 1 |
| [ ] | P0-03 | `api/go.mod` (`toawang`) · `go get` ครบ 5 package · โฟลเดอร์ `cmd/api`, `internal/{config,database,models,handlers,middleware,booking}` | 1 | — | `go build ./...` ผ่าน · `grep "fiber/v3" api/go.mod` เจอ |
| [ ] | P0-04 | `internal/config/config.go` (อ่าน env) · `internal/database/database.go` · `cmd/api/main.go`: `BodyLimit 10MB`, `import _ "time/tzdata"`, `GET /api/v1/health` | 1.5 | P0-02, P0-03 | `curl localhost:8080/api/v1/health` → `{"status":"ok"}` · ปิด db แล้วรัน api → log บอกว่าต่อ DB ไม่ได้และ exit ≠ 0 · `time.LoadLocation("Asia/Bangkok")` ตอน start ไม่ error |
| [ ] | P0-05 | `create-next-app` ตามคำสั่งใน WALKTHROUGH · ลบ dark mode ใน `globals.css` · ล็อก `next-auth@5.0.0-beta.32` ใน `package.json` | 1 | — | `npm run build` ผ่าน · `grep prefers-color-scheme web/app/globals.css` ไม่เจอ |
| [ ] | P0-06 | `web/app/globals.css` (`@theme` จาก `tokens.css`) · `web/app/layout.tsx` (Pridi 600, Sarabun 400–700, `thai`+`latin`, `lang="th"`) · copy `design/assets/*` → `web/public/design/` | 2 | P0-05 | ครบ 22 สี: `grep -c "\-\-color-" web/app/globals.css` ≥ 22 · หน้า `/` ทดสอบ `bg-indigo text-cream font-heading` → devtools computed = `#1E2B5E` + `Pridi` · เปิด `/design/logo-seal.svg` ได้ทั้ง 6 ไฟล์ |
| [ ] | P0-07 | `web/next.config.ts` rewrites `/api/v1/:path*`, `/uploads/:path*` → `${API_URL}` · `web/.env.local` (`API_URL`) | 0.5 | P0-04, P0-05 | `http://localhost:3000/api/v1/health` → `{"status":"ok"}` · `/api/auth/anything` **ไม่**ไปถึง Go (ดู log Go ต้องไม่มี request) |

**งานของคุณ (~1 ชม.)**
- [ ] เปิด Rancher Desktop → Preferences → Container Engine เลือก **dockerd (moby)** (ถ้าเป็น containerd คำสั่ง `docker compose` จะใช้ไม่ได้ `[I]`) → รอจนไอคอนเขียว → `docker ps` ไม่ error
- [ ] ตอบ D1–D8 ใน §1 (หรือพิมพ์ว่า "ใช้ค่าเริ่มต้น")
- [ ] เปิด `http://localhost:3000/api/v1/health` ในเบราว์เซอร์เอง เห็น `{"status":"ok"}`
- [ ] ดูหน้าทดสอบฟอนต์: ภาษาไทยเป็น Pridi / Sarabun จริง สระไม่ลอย ไม่ใช่ฟอนต์ระบบ

✅ **Exit:** P0-07 ผ่าน

---

## Phase 1 — Models + Auth · 26–27 ก.ย. · 18 ชม. (เกิน 4)

**Backend**

| ✓ | ID | งาน · ไฟล์ที่แตะ | ชม. | Depends | DoD |
|---|---|---|---|---|---|
| [ ] | P1-01 | `internal/models/{user,restaurant,restaurant_image,booking,review}.go` ตามตาราง WALKTHROUGH · `check:` 4 ข้อ · `AutoMigrate` ใน `main.go` · FK `restaurant_images` ลบตามร้าน (`OnDelete:CASCADE`) | 2 | P0-04 | ใน `psql`: `\d restaurants` เห็น check `seats > 0`, `cancel_lead_minutes >= 30` · `\d reviews` เห็น unique index `(restaurant_id, user_id)` · `\d bookings` → `start_at`/`end_at` เป็น `timestamptz`, `service_date` เป็น `date` · `INSERT ... seats = 0` ถูก DB ปฏิเสธ |
| [ ] | P1-02 | `internal/handlers/errors.go`: type `AppError{Status, Code, Message, Details}` + `fiber.Config.ErrorHandler` + recover middleware · ใช้ code ตาม §2 | 1 | P0-04 | `GET /api/v1/nope` → 404 `{"error":{"code":"NOT_FOUND",...}}` · handler ที่ panic → 500 `INTERNAL` รูปแบบเดียวกัน ไม่มี stack trace ใน body · JSON พัง → 400 `VALIDATION` |
| [ ] | P1-03 | `internal/handlers/auth.go`: register (trim + lowercase email, รหัส ≥ 8 + มีตัวเลข, bcrypt) · login (JWT HS256, `sub`=userID, `exp`=+7 วัน) · สร้าง `api/requests.http` หมวด auth | 2 | P1-01, P1-02 | ใน `requests.http`: สมัครสำเร็จ 201 และ response **ไม่มี** `passwordHash` · สมัคร `A@x.com` แล้ว `a@x.com` → 409 `EMAIL_TAKEN` · รหัส `abcdefgh` → 400 · login รหัสผิด กับ อีเมลไม่มีในระบบ → 401 body **เหมือนกันทุกตัวอักษร** · decode token ได้ `alg: HS256`, `exp - iat = 604800` |
| [ ] | P1-04 | `internal/middleware/auth.go` (~20 บรรทัด, `jwt.WithValidMethods([]string{"HS256"})`, `c.Locals("userID")`) · `GET /api/v1/me` | 1 | P1-03 | ไม่มี header → 401 · token ที่แก้ payload/เซ็นด้วย secret อื่น/`alg: none` → 401 · token หมดอายุ → 401 · token ถูก → `/me` ได้ `{id, name, email}` |
| [ ] | P1-05 | `api/cmd/seed/main.go` แบบย่อ: user 2 คน · ร้าน 2 ร้าน (ครัวริมคลอง 10 ที่ 11:00–22:00 · ข้าวต้มโต้รุ่ง 20 ที่ 18:00–02:00) + รูป 1 รูป/ร้าน | 1.5 | P1-01 | `go run ./cmd/seed` 2 ครั้งติด → `select count(*) from users` = 2 (ไม่ซ้ำ) · login ด้วยบัญชี seed ได้ token |

**Frontend**

| ✓ | ID | งาน · ไฟล์ที่แตะ | ชม. | Depends | DoD |
|---|---|---|---|---|---|
| [ ] | P1-06 | `web/auth.ts` (Credentials → `${API_URL}/api/v1/auth/login` ฝั่ง server) · `jwt`/`session` callback เก็บ `accessToken` **และ `user.id`** · `maxAge` 7 วัน · `app/api/auth/[...nextauth]/route.ts` · `types/next-auth.d.ts` · env `AUTH_SECRET`, `AUTH_TRUST_HOST` | 2 | P1-03, P0-07 | login ด้วย user seed แล้ว `GET /api/auth/session` เห็น `accessToken` + `user.id` · รหัสผิด → `signIn` คืน error (ไม่ใช่หน้า 500) · `tsc --noEmit` ผ่าน (`session.accessToken` ไม่ขึ้นแดง) |
| [ ] | P1-07 | `web/lib/api.ts`: `apiFetch()` แนบ Bearer, โยน `ApiError{status, code, message, details}`, 401 → `signOut()` · แยก `serverFetch()` ใช้ `auth()` + `API_URL` แบบ absolute `[I: fetch ฝั่ง server ใช้ path relative ไม่ได้]` · `app/providers.tsx` (`SessionProvider` + `QueryClientProvider`) | 1.5 | P1-06 | client component เรียก `/api/v1/me` ได้ชื่อ · server component เรียก `serverFetch('/api/v1/me')` ได้ชื่อ · แก้ `AUTH_SECRET` ฝั่ง Go ให้ token เดิมใช้ไม่ได้ → หน้าเว็บ sign out และไป `/login` · `err.code === "UNAUTHORIZED"` |
| [ ] | P1-08 | UI ชุดแรก `web/components/ui/{Button,Input,Field,Checklist,Logo}.tsx` + หน้า `/dev/ui` โชว์ทุก state | 1.5 | P0-06 | `/dev/ui`: Button 4 แบบ (primary คราม / CTA ชาด / outline / danger) × default/disabled · กด Tab เห็น focus ring ชาด 2px · Input สถานะ error = ขอบชาด + ข้อความใต้ช่อง · Checklist ✓/✕ มีไอคอน + ข้อความ (ไม่ใช่สีอย่างเดียว) · ปุ่มสูง ≥ 44px |
| [ ] | P1-09 | App shell: `components/layout/{Header,TabBar,KruayBand,AvatarMenu}.tsx` · `app/(main)/layout.tsx` · `app/(auth)/layout.tsx` (ไม่มี tab bar) `[I: WALKTHROUGH ไม่ได้แยก ticket แต่ทุกหน้าต้องใช้]` | 2 | P1-08, P1-06 | 1440px: header โลโก้ + 3 เมนู + avatar + แถบกรวยเชิงคราม · เมนูปัจจุบันตัวชาด + ขีดใต้ 2px · 390px: top bar + tab bar 3 เมนูล่างจอ · หน้า login ไม่มี tab bar · avatar → ออกจากระบบได้ |
| [ ] | P1-10 | `app/(auth)/login/page.tsx` · `app/(auth)/register/page.tsx` · `lib/schemas/auth.ts` (zod กติกาเดียวกับ Go) | 3 | P1-06, P1-08 | เทียบ `Auth.dc.html`/`Register.dc.html` (1440) และ `MLogin`/`MRegister` (390) · checklist รหัสผ่านเปลี่ยน ✓/✕ ขณะพิมพ์ · ปุ่มสมัคร disabled จนกว่าผ่านครบ + ติ๊กยอมรับ · อีเมลซ้ำ → ข้อความ 409 ขึ้นใต้ช่องอีเมล · สมัครเสร็จ → `signIn` อัตโนมัติ → `/` (สวิตช์เปิดร้าน = `/owner/restaurants/new`) |
| [ ] | P1-11 | `web/lib/require-session.ts`: `await auth()` ไม่มี → `redirect("/login?callbackUrl=...")` · login สำเร็จกลับ callbackUrl | 0.5 | P1-06 | logout แล้วเปิด `/bookings` → ไป `/login?callbackUrl=%2Fbookings` → login แล้วกลับ `/bookings` |

**งานของคุณ (~2 ชม.)**
- [ ] ส่งชื่อ/อีเมล/รหัสบัญชีทดสอบให้ Claude ก่อน P1-05
- [ ] สมัคร → logout → login ในเบราว์เซอร์จริง ทั้งจอ 1440 และ 390 (DevTools → Toggle device toolbar)
- [ ] เทียบหน้า login/สมัครกับ canvas ทีละส่วน: สี · ฟอนต์ · ระยะ · แผงลายประจำยาม
- [ ] เปิด `/dev/ui` กด Tab ไล่ทุกปุ่ม เห็นกรอบชาด
- [ ] ดู `\d bookings` ใน psql ด้วยตัวเอง — **หลังจุดนี้แก้ schema แพง**
- [ ] เข้าใจ auth flow พอจะวาดบนกระดาษได้ + เตรียมคำตอบ "ทำไมให้ client อ่าน token ได้" (ข้อแลกใน WALKTHROUGH)

✅ **Checkpoint 1 — ห้ามเริ่ม Phase 2 จนกว่า:**
- สมัคร → login → หน้าเว็บเรียก `/api/v1/me` ได้ชื่อตัวเอง (DoD ของ WALKTHROUGH)
- 3 เรื่องที่ "แก้ทีหลังแพง" ล็อกแล้ว: schema (`\d bookings` ตรงตาราง) · auth flow · error shape (ครบ §2)

---

## Phase 2 — ร้าน · 28–29 ก.ย. · 18.5 ชม. (เกิน 4.5)

**Backend**

| ✓ | ID | งาน · ไฟล์ที่แตะ | ชม. | Depends | DoD |
|---|---|---|---|---|---|
| [ ] | P2-01 | `internal/handlers/restaurants.go`: POST / PUT / DELETE + ตรวจฟอร์ม (รูป ≥ 1 และ URL ต้องขึ้นต้น `/uploads/` · seats > 0 · lead ≥ 30 · open ≠ close · ลง :00/:30) · owner check → 403 · DELETE มีการจอง `confirmed` ที่ `start_at > now` → 409 · หมวด restaurants ใน `requests.http` | 3 | P1-04 | `requests.http`: ไม่มีรูป / seats 0 / lead 20 / open = close / open 10:15 → 400 `VALIDATION` พร้อม `details` ชี้ field · user B `PUT` ร้านของ A → 403 · ลบร้านที่มีการจองพรุ่งนี้ (insert ผ่าน psql) → 409 `HAS_FUTURE_BOOKINGS` · ลบร้านไม่มีการจอง → 204 และ `restaurant_images` ของร้านหายด้วย |
| [ ] | P2-02 | `internal/handlers/uploads.go`: `POST /api/v1/uploads` (ต้อง login) · `http.DetectContentType` 512 byte แรก · ≤ 5MB · ชื่อไฟล์สุ่ม · เสิร์ฟ `/uploads/*` ด้วย `middleware/static` | 1.5 | P1-04 | png → 201 `{url:"/uploads/<สุ่ม>.png"}` และเปิด `http://localhost:3000<url>` เห็นรูป · ไฟล์ .txt เปลี่ยนนามสกุลเป็น .jpg → 400 `UNSUPPORTED_FILE` · 6MB → 400 · ส่งชื่อ `../../x.jpg` → ไฟล์ยังอยู่ใน `api/uploads/` ด้วยชื่อสุ่ม |
| [ ] | P2-03 | `GET /restaurants?q=` · `GET /restaurants/:id` · `GET /me/restaurants` · query รายการใช้ `LEFT JOIN reviews` คืน `avgRating`, `reviewCount`, `hasEnoughReviews` **ตั้งแต่ตอนนี้** (ย้ายจาก Phase 5 เพราะการ์ดต้องแสดงตราคะแนน `[I]`) · ค่าคงที่ `MinReviewsForRanking = 5` | 2.5 | P2-01 | `?q=ครัว` ได้เฉพาะร้านที่ชื่อ/ประเภทตรง (D3) · ร้านไม่มีรีวิว → `avgRating: null, reviewCount: 0` · detail: รูปเรียงตาม `position` · `distribution` มี key 1–5 ครบเสมอ (ไม่มี = 0) · id ไม่มี → 404 `NOT_FOUND` · `/me/restaurants` ไม่มีร้านคนอื่นปน |

**Frontend**

| ✓ | ID | งาน · ไฟล์ที่แตะ | ชม. | Depends | DoD |
|---|---|---|---|---|---|
| [ ] | P2-04 | UI ชุดสอง `components/ui/{Segmented,Stepper,Badge,RatingSeal,DomeImage,SectionHeading}.tsx` + เพิ่มใน `/dev/ui` | 2.5 | P1-08 | Segmented ใช้ `aria-pressed` · Stepper ปุ่ม − disabled ที่ค่าต่ำสุด, + disabled ที่ค่าสูงสุด · Badge 3 แบบ (ร้านของคุณ / ข้ามเที่ยงคืน + ไอคอน Moon / รีวิวยังน้อย) · RatingSeal 64/88/44px และสี `#8A7456` เมื่อ `hasEnoughReviews=false` · DomeImage ใช้ radius ทรงซุ้มตาม HANDOFF §3 |
| [ ] | P2-05 | หน้า `/` `app/(main)/page.tsx` · `components/restaurant/{RestaurantCard,SearchHero}.tsx` | 3 | P2-03, P2-04, P1-09 | เทียบ `Main.dc.html`/`MSearch.dc.html` · พิมพ์ค้นหา debounce 300ms แล้ว URL เป็น `?q=` (reload แล้วค่ายังอยู่) · ไม่เจอร้าน → empty state · badge "ร้านของคุณ" เมื่อ `ownerId === session.user.id` · badge ข้ามเที่ยงคืนเมื่อ `close <= open` · segmented เรียงยังไม่มีผลจนถึง P5-05 |
| [ ] | P2-06 | หน้า `/restaurants/[id]` (`const { id } = await params`) · แกลเลอรีทรงซุ้ม · ข้อมูลเวลาเปิด + คำอธิบายข้ามเที่ยงคืน · ที่นั่ง · ยกเลิกล่วงหน้า · ตรา 88px + แท่งกระจายดาว · **ช่องว่างไว้ใส่ใบจอง** | 2 | P2-03, P2-04 | เทียบ `Restaurant.dc.html` คอลัมน์ซ้าย · id ไม่มี → `notFound()` · ร้าน 18:00–02:00 แสดง badge + ข้อความว่าหลัง 00:00 นับเป็นรอบคืนเดียวกัน |
| [ ] | P2-07 | `/owner/restaurants/new` และ `/owner/restaurants/[id]/edit` ใช้ `components/restaurant/RestaurantForm.tsx` ตัวเดียว · `lib/schemas/restaurant.ts` · อัปโหลดรูป + preview + ลบ · stepper lead ทีละ 15 + ปุ่มลัด 30น./1ชม./2ชม./3ชม. · ช่อง cuisine (ไม่บังคับ) · ปุ่มลบร้าน + ยืนยัน | 4 | P2-01, P2-02, P2-04 | เทียบ `RestaurantForm.dc.html`/`MShopForm.dc.html` · lead ปุ่ม − disabled ที่ 30 · ปิด < เปิด ขึ้นคำใบ้ข้ามเที่ยงคืน · `details` จาก Go 400 ไปโผล่ใต้ช่องที่ถูก · หน้า edit เปิดมามีค่าเดิมครบ · คนอื่นเปิด edit → 403 จาก Go → แสดงหน้า "ไม่มีสิทธิ์" · บันทึกแล้วไป `/restaurants/[id]` · ลบร้านที่มีการจอง → ขึ้นข้อความ 409 |

**งานของคุณ (~2 ชม.)**
- [ ] สร้างร้านด้วยรูปจริงจากเครื่อง ทั้งร้านปกติและร้านข้ามเที่ยงคืน → ขึ้นในหน้าค้นหา
- [ ] login อีกบัญชี → พิมพ์ URL `/owner/restaurants/<id ร้านคนอื่น>/edit` เอง → ต้องเข้าไม่ได้
- [ ] เทียบหน้าค้นหา · หน้าร้าน · ฟอร์มร้าน กับ canvas ทั้ง desktop และมือถือ
- [ ] เริ่มหารูปอาหารสำหรับ seed (Unsplash / Pexels ใช้ฟรี) ทยอยทำได้ถึง 7 ต.ค.

✅ **Exit (WALKTHROUGH):** สร้างร้านพร้อมรูปแล้วเห็นในหน้าค้นหา · login เป็นคนอื่นแล้วยิง PUT ได้ 403

---

## Phase 3 — การจอง (แกนหลัก) · 30 ก.ย.–2 ต.ค. · 18 ชม.

logic ทั้งหมดอยู่ใน `api/internal/booking/` แยกจาก handler `[F]`

**Backend**

| ✓ | ID | งาน · ไฟล์ที่แตะ | ชม. | Depends | DoD |
|---|---|---|---|---|---|
| [ ] | P3-01 | `internal/booking/time.go`: `ParseHHMM`, `Window(date, open, close)`, `Resolve(date, "HH:MM", r)` ตามข้อ ① ใน WALKTHROUGH · ใช้ location `Asia/Bangkok` ตัวเดียวทั้ง package | 2 | P1-01 | ผลลัพธ์ต้องตรงตารางเคสด้านล่าง **ทุกแถว** (ตรวจผ่าน availability ใน P3-04 หรือ `fmt.Println` ชั่วคราว) |
| [ ] | P3-02 | `internal/booking/validate.go`: ตรวจตามลำดับ `INVALID_SLOT` → `INVALID_RANGE` → `OUTSIDE_HOURS` → `IN_PAST` → `VALIDATION`(partySize) · รับ `now func() time.Time` เป็นพารามิเตอร์ | 1.5 | P3-01, P1-02 | ส่ง input ที่ผิด 2 ข้อพร้อมกัน → ได้ code ของข้อที่มาก่อนตามลำดับ · ตาราง §เคสทดสอบ แถว 5–9 ได้ code ถูก |
| [ ] | P3-03 | `internal/booking/service.go`: `Reserve(tx, restaurantID, userID, input, excludeID)` ใช้ได้ทั้งสร้างใหม่และแก้ไข (P4-02) · lock แถวร้าน `FOR UPDATE` · ดึงการจองที่ซ้อน · วนช่อง 30 นาทีจาก `startAt` ถึง `endAt` · เกิน → `SEATS_EXCEEDED` + details | 3 | P3-02 | ร้าน 10 ที่ มีการจอง 7 คน 12:00–13:00: จอง 3 → 201 · จอง 4 → 409 `details = {slotStart:"12:00", slotEnd:"12:30", used:7, party:4, seats:10}` · **ใน closure ของ `Transaction` ไม่มี `db.` เลย:** `grep -n "db\." internal/booking/service.go` ไม่เจอบรรทัดที่อยู่ในบล็อก Transaction · partySize > seats → 409 ทันที |
| [ ] | P3-04 | `GET /restaurants/:id/availability?date=&excludeBookingId=` → `[{start:"11:00", used:7}, ...]` ครอบทั้ง window ของวันนั้น (ร้านข้ามเที่ยงคืนต่อถึง 01:30) · ใช้ query ซ้อนตัวเดียวกับ P3-03 · ตาม D2 | 2 | P3-01 | ครัวริมคลองได้ 22 ช่อง (11:00–21:30) · ข้าวต้มโต้รุ่งได้ 16 ช่อง (18:00–01:30) · `used` ตรงกับ SQL มือ `SELECT sum(party_size) ... WHERE start_at < slotEnd AND end_at > slotStart AND status='confirmed'` · `excludeBookingId` ของตัวเอง → `used` ลดลงเท่ากับ party ของการจองนั้น |
| [ ] | P3-05 | `POST /restaurants/:id/bookings` (ต้อง login) · response มี `serviceDate`, `start`, `end` เป็นสตริงเวลาไทย + `status` + `cancelDeadline` | 1.5 | P3-03 | 201 body มี `start:"01:00"` สำหรับการจอง 01:00 ของร้านข้ามคืน (ไม่ใช่ `"2026-..T18:00:00Z"`) · ไม่มี token → 401 · ร้านไม่มี → 404 |
| [ ] | P3-06 | หมวด booking ใน `api/requests.http` ครบทุกแถวในตารางด้านล่าง · แต่ละ request มีคอมเมนต์ `### คาดหวัง: 409 SEATS_EXCEEDED` · เพิ่มสคริปต์ยิงพร้อมกัน `api/scripts/race.sh` | 1 | P3-05 | รันไล่ตั้งแต่บนลงล่างบน DB ที่เพิ่ง seed → ผลตรงคอมเมนต์ทุกข้อ · `race.sh` ยิง 2 request จองที่นั่งสุดท้ายพร้อมกัน 5 รอบ → ทุกรอบได้ 201 หนึ่งตัว + 409 หนึ่งตัว |

**เคสทดสอบ (ใช้ทั้ง P3-01 ถึง P3-06)** — ร้าน A = 11:00–22:00 · ร้าน B = 18:00–02:00 · วันที่ `D` = พรุ่งนี้

| # | ร้าน | input | คาดหวัง |
|---|---|---|---|
| 1 | B | start `01:00` | `startAt` = D+1 01:00 +07 → ผ่าน |
| 2 | B | start `18:00` end `02:00` | `endAt` = D+1 02:00 = windowEnd → ผ่าน |
| 3 | B | start `17:30` | แปลงเป็น D+1 17:30 → `OUTSIDE_HOURS` |
| 4 | ร้าน `close = 00:00` | start `23:00` end `00:00` | windowEnd = D+1 00:00 → ผ่าน `[I: edge ที่เอกสารไม่ได้พูดถึง]` |
| 5 | A | start `10:15` | `INVALID_SLOT` |
| 6 | A | start `20:00` end `19:00` | `INVALID_RANGE` |
| 7 | A | start `21:00` end `22:30` | `OUTSIDE_HOURS` |
| 8 | A | date = เมื่อวาน | `IN_PAST` |
| 9 | A | partySize `0` | `VALIDATION` |
| 10 | A (10 ที่) | 7 จองอยู่ 12:00–13:00 · ขอ 4 | `SEATS_EXCEEDED` used 7 |
| 11 | A | ยิงพร้อมกัน 2 คน ที่เหลือพอ 1 คน | สำเร็จ 1 · 409 1 |

**Frontend**

| ✓ | ID | งาน · ไฟล์ที่แตะ | ชม. | Depends | DoD |
|---|---|---|---|---|---|
| [ ] | P3-07 | `web/lib/booking.ts`: สร้างรายการเวลา (ต่อหลัง 00:00 เมื่อข้ามคืน) · คำนวณช่องเต็ม/`firstOver`/`peak`/`left` · ข้อความ seatText · ข้อความ "ยกเลิกได้ถึง" — แปลงจาก `renderVals()` ใน [Restaurant.dc.html:287](design/reference/desktop/Restaurant.dc.html#L287) | 2 | — | ใส่ข้อมูล `booked` วันที่ `'25'` จากไฟล์ reference แล้วได้ข้อความ seatText **ตรงทุกตัวอักษร** กับที่ `renderVals()` ให้ ≥ 2 เคส (พอ / พอดี) · เคสเกินใช้ข้อความที่เราปรับเอง (ดู HANDOFF §การจอง) ตัวเลขช่วง/จองแล้ว/คุณ/รวม ต้องตรงกับ `renderVals()` · ร้าน 18:00–02:00 ได้รายการเวลา 18:00 … 01:30 |
| [ ] | P3-08 | `components/booking/{BookingTicket,DateDomes,TimeSelect,SeatTimeline}.tsx` ใส่ในหน้าร้าน · TanStack Query key `["availability", id, date]` · ส่งด้วย `useMutation` | 5 | P3-04, P3-05, P3-07, P2-06 | เทียบ `Restaurant.dc.html` (ใบจองกว้าง 470px) / `MRestaurant.dc.html` · หัวชาด + ลาย + แถบกรวยเชิง + รอยปรุ + รอยบาก 28px · เปลี่ยนวัน → กราฟโหลดใหม่ · ช่วงที่ผ่านแล้วจาง · stepper + disabled ที่จำนวนที่นั่งร้าน · ปุ่มยืนยัน disabled เมื่อมีเงื่อนไข ✕ · ยังไม่ login → ปุ่มพาไป `/login?callbackUrl=` · **Go ตอบ 409 → ข้อความ "ช่วง HH:MM–HH:MM ร้านรับได้ N ที่ จองไปแล้ว X + คุณจองเพิ่ม Y = Z คน เกินไป Z−N คน" สร้างจาก `details`** · ผลตรวจที่นั่งอยู่ใน `aria-live` · สำเร็จ → ไป `/bookings` |

**งานของคุณ (~3.5 ชม.) — phase ที่สำคัญที่สุดสำหรับคุณ เพราะต้องอธิบายในวิดีโอเอง**
- [ ] ติดตั้ง VS Code extension **REST Client** (`humao.rest-client`) แล้วกด "Send Request" ไล่ `requests.http` เองทีละเคส
- [ ] **อ่าน `api/internal/booking/` จนตอบ 4 ข้อนี้ได้โดยไม่เปิดโน้ต:**
  1. ทำไมต้อง lock แถวร้าน ถ้าไม่ lock สองคนกดพร้อมกันจะเกิดอะไร
  2. ทำไมต้องเช็กทีละช่อง 30 นาที แทนการรวมคนทั้งช่วง (ยกตัวอย่าง: การจอง 12:00–12:30 กับ 12:30–13:00 ไม่ได้ซ้อนกันเอง)
  3. ทำไมทุกคำสั่งใน `Transaction` ต้องใช้ `tx` ไม่ใช่ `db`
  4. ร้าน 18:00–02:00 เวลา "01:00" ถูกแปลงเป็นวันไหน ตรงบรรทัดไหน
- [ ] เปิด 2 แท็บ (บัญชีต่างกัน) จองที่นั่งสุดท้ายพร้อมกัน → แท็บหนึ่งต้องเห็นข้อความที่นั่งไม่พอ
- [ ] จองผ่านหน้าเว็บ: ร้านข้ามคืนตอน 01:00 · ช่วงเวลาที่ผ่านไปแล้ว (ต้องกดไม่ได้หรือถูกปฏิเสธ)
- [ ] เทียบใบจองกับ canvas: หัวชาด · รอยปรุ · รอยบากครึ่งวงกลม · กราฟที่นั่ง

✅ **Checkpoint 2 — ห้ามเริ่ม Phase 4 จนกว่า:**
- เคส 1–11 ผ่านครบผ่าน `requests.http` + `race.sh`
- เปิด 2 แท็บ จองที่นั่งสุดท้ายพร้อมกันจากหน้าเว็บ → แท็บที่ช้ากว่าเห็นข้อความ 409
- commit ไฟล์ `.http` ไว้ใช้ตอนอัดวิดีโอ

---

## Phase 4 — การจองของฉัน · 3–4 ต.ค. · 13.5 ชม.

| ✓ | ID | งาน · ไฟล์ที่แตะ | ชม. | Depends | DoD |
|---|---|---|---|---|---|
| [ ] | P4-01 | `GET /api/v1/me/bookings` → `{upcoming:[], past:[]}` ตาม D1 · แต่ละรายการมีชื่อร้าน, `start`, `end`, `serviceDate`, `status`, `cancelDeadline`, `canCancel` (คำนวณที่ Go) | 1.5 | P3-05 | upcoming เรียงเวลาใกล้ → ไกล · past เรียงล่าสุดก่อน · ไม่มีการจองของ user อื่นปน · `canCancel` = false เมื่อ `now > startAt − lead` |
| [ ] | P4-02 | `PUT /api/v1/bookings/:id` เรียก `Reserve(..., excludeID = id)` แล้วอัปเดตแถวเดิมใน tx เดียวกัน · ไม่ใช่เจ้าของ → 403 (D4) · ยกเลิกแล้ว → 409 `BOOKING_CANCELLED` · เลยเวลา → 409 `CANCEL_WINDOW_PASSED` | 2 | P3-03 | **ร้าน 10 ที่ · A 7 · B 3 (ช่วงเดียวกัน):** A แก้เป็น 8 → 409 `details.used = 3` · A แก้เป็น 5 → 200 · B แก้การจองของ A → 403 · แก้การจองที่ยกเลิกแล้ว → 409 |
| [ ] | P4-03 | `POST /api/v1/bookings/:id/cancel` ได้เมื่อ `now <= startAt − lead` → `status = cancelled`, `cancelledAt = now` | 1 | P1-01 | ก่อนเส้นตาย → 200 · หลัง → 409 `CANCEL_WINDOW_PASSED` · ยกเลิกซ้ำ → 409 `BOOKING_CANCELLED` · หลังยกเลิก availability ช่องนั้น `used` ลดลง |
| [ ] | P4-04 | หมวด my-bookings ใน `requests.http` (เคส A 7→8 / 7→5, ยกเลิกเลยเวลา, 403) | 0.5 | P4-02, P4-03 | รันบน seed ใหม่ ผลตรงคอมเมนต์ทุกข้อ |
| [ ] | P4-05 | หน้า `/bookings` `app/(main)/bookings/page.tsx` · `components/booking/BookingStub.tsx` | 3 | P4-01, P2-04, P1-11 | เทียบ `MyBookings.dc.html` (เนื้อหากว้าง 960) / `MBookings.dc.html` · ต้นขั้ว: วันนี้ = ชาด, ปกติ = คราม, ยกเลิก = `#8A7A66` + การ์ดจาง 72% · แยกส่วน กำลังจะถึง / ที่ผ่านมา · ไม่มีการจอง → empty state + ปุ่มไปหน้าค้นหา |
| [ ] | P4-06 | ยกเลิกแบบยืนยัน inline ใน `BookingStub` | 1.5 | P4-03, P4-05 | กดยกเลิก → แถบชมพูยืนยัน/ไม่ยกเลิก · `canCancel=false` → ปุ่ม disabled + ข้อความชาดบอกเวลาที่เลยไป · ยืนยันแล้วการ์ดเปลี่ยนเป็นสถานะยกเลิก **โดยไม่ reload** (invalidate query) |
| [ ] | P4-07 | `components/booking/{EditBookingDialog,SeatDots}.tsx` · < 768 = bottom sheet · ≥ 768 = dialog `[A]` · ใช้ `DateDomes`/`TimeSelect` จาก P3-08 · เรียก availability พร้อม `excludeBookingId` | 4 | P4-02, P3-08 | เทียบ `EditBooking.dc.html` / `MEditBooking.dc.html` · เคส A 7→8 ขึ้น ✕ ก่อนกดส่ง และ dots แสดงช่อง "เกิน" แยกด้วยเส้นประ · 7→5 บันทึกได้และการ์ดอัปเดต · Esc ปิดได้ · focus กลับไปที่ปุ่มแก้ไขหลังปิด |

**งานของคุณ (~1.5 ชม.)**
- [ ] เดินเคส A 7→8 ✕ / 7→5 ✓ ในหน้าเว็บด้วย 2 บัญชี (ซ้อมไว้เลย เป็นฉากในวิดีโอ)
- [ ] ยกเลิกการจองที่เลยเวลาแล้ว: สร้างร้านที่ยกเลิกล่วงหน้า 3 ชม. แล้วจองช่วง 1–2 ชม. ข้างหน้า → ปุ่มยกเลิกต้องกดไม่ได้
- [ ] เปิดหน้าแก้ไขบนมือถือจริง (เปิด `http://<IP เครื่อง>:3000` ใน Wi-Fi เดียวกัน) หรือ DevTools 390 → เป็น bottom sheet

✅ **Exit (WALKTHROUGH):** เคส A 7→8 / 7→5 ถูกต้อง · ปุ่มยกเลิก disabled เมื่อเลยเวลา

---

## Phase 5 — รีวิว + การเรียง · 5–6 ต.ค. · 9.5 ชม.

| ✓ | ID | งาน · ไฟล์ที่แตะ | ชม. | Depends | DoD |
|---|---|---|---|---|---|
| [ ] | P5-01 | `internal/handlers/reviews.go`: `GET /restaurants/:id/reviews` (ล่าสุดก่อน, มีชื่อผู้รีวิว) · `PUT /restaurants/:id/reviews/me` upsert `clause.OnConflict{Columns: restaurant_id,user_id}` · เจ้าของ → 403 `OWN_RESTAURANT` · rating จำนวนเต็ม 1–5 · comment ตาม D5 · หมวด reviews ใน `requests.http` | 2 | P2-03 | PUT 2 ครั้ง → `select count(*) from reviews where ...` = 1 และค่าเป็นของครั้งหลัง · rating 0 / 6 / 3.5 → 400 · เจ้าของรีวิวร้านตัวเอง → 403 · `GET /restaurants/:id` หลังรีวิว → `avgRating`, `reviewCount`, `distribution` เปลี่ยนตาม |
| [ ] | P5-02 | เพิ่ม `sort` ใน `GET /restaurants`: `rating` → `ORDER BY (review_count >= 5) DESC, avg_rating DESC NULLS LAST, review_count DESC` · `reviews` → `ORDER BY review_count DESC, avg_rating DESC` · ค่าอื่น → 400 · default ตาม D8 | 1.5 | P2-03 | ข้อมูล: ร้าน X 5.0 (1 รีวิว) กับร้าน Y 4.8 (126 รีวิว) → `sort=rating` Y มาก่อน X · X อยู่ท้ายรายการ · `sort=reviews` ร้านที่รีวิวเยอะสุดอยู่บน · `grep -rn ">= 5\|< 5" api/internal/` ไม่เจอ (เกณฑ์ต้องอ้าง `MinReviewsForRanking` ที่เดียว) |
| [ ] | P5-03 | `components/review/{ReviewList,StarPicker,ReviewForm,OwnerLockedBox}.tsx` ใส่ในหน้าร้าน · ป้าย `labels` จาก [Restaurant.dc.html:368](design/reference/desktop/Restaurant.dc.html#L368) (แย่ / พอใช้ / ดี / ดีมาก / ยอดเยี่ยม) | 3.5 | P5-01, P2-06 | ป้ายเริ่มต้น "แตะดาวเพื่อให้คะแนน" → เลือก 4 = "4 ดาว — ดีมาก" · ปุ่มโพสต์ disabled จนเลือกดาว · ดาวใช้คีย์บอร์ด (ลูกศร) ได้ · เคยรีวิวแล้ว → ฟอร์มเปิดมามีค่าเดิม · เจ้าของเห็นกล่องล็อก "รีวิวร้านของตัวเองไม่ได้" แทนฟอร์ม · โพสต์แล้วตรา + แท่งดาวอัปเดตโดยไม่ reload |
| [ ] | P5-04 | เพิ่ม `hasReviewed` ใน `/me/bookings` · การ์ดส่วน "ที่ผ่านมา" มีปุ่ม "เขียนรีวิว" (→ `/restaurants/[id]#review`) หรือป้าย "รีวิวแล้ว" | 1.5 | P4-05, P5-01 | ร้านที่เคยรีวิว → ป้าย "รีวิวแล้ว" ทุกการ์ดของร้านนั้น · กด "เขียนรีวิว" → เลื่อนไปที่ฟอร์ม |
| [ ] | P5-05 | ผูก Segmented เรียงในหน้า `/` กับ `?sort=` | 1 | P5-02, P2-05 | สลับเรียงแล้วลำดับการ์ดเปลี่ยน · reload แล้วค่าเรียงยังอยู่ · ร้าน "รีวิวยังน้อย" อยู่ท้ายเมื่อเรียงตามคะแนน |

**งานของคุณ (~1 ชม.)**
- [ ] รีวิวด้วยบัญชีลูกค้า → แก้รีวิวเดิม → จำนวนรีวิวต้องไม่เพิ่ม
- [ ] login เป็นเจ้าของ → หน้าร้านตัวเองต้องเห็นกล่องล็อก
- [ ] สลับเรียงคะแนน / รีวิวมากสุด ดูว่าลำดับสมเหตุสมผล + เตรียมคำตอบ "ทำไมใช้เกณฑ์ < 5 แทน Bayesian average"

✅ **Exit (WALKTHROUGH):** ร้าน 5.0 (1 รีวิว) อยู่ท้ายรายการเมื่อเรียงตามคะแนน

---

## Phase 6 — Dashboard เจ้าของร้าน · 7 ต.ค. · 5 ชม.

| ✓ | ID | งาน · ไฟล์ที่แตะ | ชม. | Depends | DoD |
|---|---|---|---|---|---|
| [ ] | P6-01 | `GET /restaurants/:id/bookings?date=` (เจ้าของเท่านั้น) → ชื่อลูกค้า, จำนวนคน, `start`, `end`, `status` เรียงตามเวลา รวมที่ยกเลิก | 1 | P3-05 | คนอื่นเรียก → 403 · ร้านข้ามคืน: การจอง 01:00 ของรอบคืนวันที่ D แสดงเมื่อ `date=D` (ใช้ `service_date`) |
| [ ] | P6-02 | หน้า `/owner` `app/(main)/owner/page.tsx` · `components/owner/{RestaurantSwitcher,OwnerBanner,BookingTable}.tsx` · กราฟใช้ `SeatTimeline` จาก P3-08 + availability ตัวเดิม | 4 | P6-01, P3-08, P2-03 | เทียบ `OwnerDashboard.dc.html`/`MOwner.dc.html` · สลับร้านได้ (จำใน `?r=`) · แบนเนอร์พื้นลายประจำยาม: คะแนนเฉลี่ย · ที่นั่ง · เวลาเปิด · ยกเลิกล่วงหน้า · ปุ่ม ดูหน้าร้าน / แก้ไขร้าน / สร้างร้านใหม่ · ยังไม่มีร้าน → empty state ชวนสร้างร้าน |

**งานของคุณ (~1 ชม.)**
- [ ] login เป็นมะลิ → สลับ 2 ร้าน → เลือกวันที่มีการจอง → ตัวเลขในกราฟตรงกับตาราง
- [ ] เทียบ dashboard กับ canvas ทั้ง desktop และมือถือ

---

## Phase 7 — Seed · Docker · README · Responsive · 8–9 ต.ค. · 13.5 ชม.

| ✓ | ID | งาน · ไฟล์ที่แตะ | ชม. | Depends | DoD |
|---|---|---|---|---|---|
| [ ] | P7-01 | ขยาย `cmd/seed`: ร้าน 7 ร้านตาม HANDOFF §7 · รูปจริงใน `api/seed/images/` (≤ 300KB/รูป) copy ไป `uploads` · user ปลอม ~320 คน · รีวิวรวม 644 รายการ (126+311+58+42+1+89+17) · ครัวริมคลองกระจาย 104/18/3/1/0 · การจองนับจากวันที่รัน seed ตาม D6 รวมเคส 7+3 = 10 · บัญชีทดสอบ มะลิ (เจ้าของ 2 ร้าน) + ลูกค้า 1 คนที่มีการจอง | 4 | P5-01, P4-01 | `SELECT r.name, ROUND(AVG(v.rating)::numeric,1), COUNT(v.id) FROM restaurants r LEFT JOIN reviews v ... GROUP BY r.name` ตรงตาราง §7 **ทั้ง 7 แถว** · login มะลิเห็น 2 ร้านใน `/owner` · login ลูกค้าเห็นการจองใน `/bookings` · เคส A 7→8 ทำได้ทันทีหลัง seed |
| [ ] | P7-02 | `SEED_ON_START=true` → รัน seed ใน `main.go` ถ้า `users` ว่าง | 0.5 | P7-01 | DB ว่าง → start แล้วมีข้อมูล · restart อีกรอบ → จำนวน users เท่าเดิม |
| [ ] | P7-03 | `api/Dockerfile` multi-stage · named volume `uploads` | 1 | P0-04 | `docker compose build api` ผ่าน · อัปโหลดรูป → `docker compose restart api` → รูปยังเปิดได้ · log ไม่มี error เรื่อง timezone |
| [ ] | P7-04 | `web/Dockerfile` (`output: "standalone"`) · `API_URL` เป็น build arg สำหรับ rewrites และเป็น runtime env สำหรับ `authorize()`/`serverFetch` `[I]` · `AUTH_SECRET` ส่งตอน run | 1.5 | P0-07 | `docker compose build web` ผ่าน · ใน container เปิด `/api/v1/health` ผ่าน web ได้ · login ใน container ได้ |
| [ ] | P7-05 | `docker-compose.yml` ครบ `db` + `api` + `web` · `api` `depends_on: db: condition: service_healthy` · `.env.example` | 0.5 | P7-02, P7-03, P7-04 | **clone ลงโฟลเดอร์ใหม่** → `cp .env.example .env` → `docker compose up --build` → เปิด `localhost:3000` เห็น 7 ร้าน และบัญชีทดสอบเห็นการจอง โดยไม่ต้องทำขั้นอื่น |
| [ ] | P7-06 | `README.md`: วิธีรัน (Docker / dev) · บัญชีทดสอบ · ตาราง env · โครงโปรเจกต์ · ตารางการตัดสินใจ (copy จาก WALKTHROUGH) · ลิงก์ canvas | 1.5 | P7-05 | คนที่ไม่เคยเห็นโปรเจกต์ทำตาม README แล้วรันได้โดยไม่ต้องถาม · ทุก env ที่โค้ดอ่าน (`grep -rn "os.Getenv\|process.env" api web --include=*.go --include=*.ts`) อยู่ในตาราง |
| [ ] | P7-07 | Responsive: `md` (768) สลับ tab bar ↔ header · `lg` (1024) layout desktop · 768–1023 grid ร้าน 2 คอลัมน์ | 3 | ทุกหน้า | ตาราง 8 หน้า × 4 ความกว้าง (390 / 768 / 1024 / 1440) ติ๊กครบ 32 ช่อง: ไม่มี scroll แนวนอน · ปุ่มแตะ ≥ 44px · ข้อความไม่ล้น |
| [ ] | P7-08 | ตรวจ a11y ตาม HANDOFF §8 | 1.5 | P7-07 | ปุ่มไอคอนทุกตัวมี `aria-label` · ใช้คีย์บอร์ดจองได้ครบ flow · `grep -rn "text-gold\b" web/` ไม่เจอ (ตัวอักษรต้องใช้ `gold-text`) |
| [ ] | P7-09 | ลบหน้า `/dev/ui` หรือซ่อนใน production | — | — | เปิด `/dev/ui` ใน container → 404 |

**งานของคุณ (~3 ชม.)**
- [ ] ใส่รูปอาหารครบ 7 ร้านก่อน P7-01 (ถ้ายังไม่ได้ทำ)
- [ ] อ่านรายละเอียดร้านและข้อความรีวิวที่ Claude ร่างใน seed → แก้ให้เป็นภาษาไทยที่คนพูดจริง
- [ ] **ทดสอบ clone ใหม่ด้วยตัวเอง:** `docker compose down -v` → clone ลงโฟลเดอร์ใหม่ → ทำตาม README ทีละบรรทัด ห้ามข้ามขั้น (ถ้ายืมเครื่องเพื่อนได้ยิ่งดี)
- [ ] ไล่ตาราง responsive 8 หน้า × 4 ความกว้างใน DevTools แล้วติ๊กเอง

✅ **Checkpoint 3:** P7-05 ผ่านบนเครื่อง/โฟลเดอร์ที่ไม่เคยรันโปรเจกต์

---

## Phase 8 — วิดีโอ + ส่งงาน · 10–11 ต.ค. · 5 ชม. (+ เวลาเผื่อ 9 ชม.)

| ✓ | ID | งาน | ชม. | Depends | DoD |
|---|---|---|---|---|---|
| [ ] | P8-01 | สคริปต์วิดีโอ `docs/VIDEO_SCRIPT.md` แบ่งเวลาเป็นวินาที | 1 | P7-05 | ส่วนเดโม ≤ 3:00 · ส่วนโค้ด ≤ 2:00 · รวมเวลาในสคริปต์ ≤ 4:45 |
| [ ] | P8-02 | อัดเดโม: สมัคร → สร้างร้าน → จอง → แก้ไข (A 7→8 ✕ / 7→5 ✓) → ยกเลิก → รีวิว → dashboard | 2 | P8-01 | ครอบทุกฟีเจอร์ใน HANDOFF §2 ทั้ง 8 หน้า |
| [ ] | P8-03 | อัดส่วนโค้ด: เปิด `internal/booking/` อธิบาย lock + วนทีละช่อง → ยิง `requests.http` + `race.sh` | 1 | P8-01 | เห็น Go ปฏิเสธอย่างน้อย `OUTSIDE_HOURS`, `IN_PAST`, `SEATS_EXCEEDED` และผล race |
| [ ] | P8-04 | ส่งงาน: push repo (D7) · ลิงก์วิดีโอ · ลิงก์ canvas · ติ๊ก checklist ส่งงานใน WALKTHROUGH | 1 | P8-02, P8-03 | เปิดลิงก์ทั้ง 3 จาก incognito ได้ · ส่งก่อน **11 ต.ค.** |

Phase นี้ **คุณทำเกือบทั้งหมด** — Claude ช่วยได้แค่ร่างสคริปต์ (P8-01) และเตรียม repo ก่อน push

**งานของคุณ (~7 ชม.)**
- [ ] แก้สคริปต์ที่ Claude ร่างให้เป็นคำพูดของตัวเอง → ซ้อมพูด 2 รอบพร้อมจับเวลา
- [ ] เตรียมเครื่องก่อนอัด: `docker compose down -v && docker compose up --build` ให้ข้อมูลเป็น seed ใหม่ · ปิดแจ้งเตือน · zoom เบราว์เซอร์/VS Code ให้ตัวอักษรอ่านได้ในวิดีโอ
- [ ] อัดหน้าจอด้วย OBS Studio (หรือ Clipchamp ที่มากับ Windows 11) → ตัดให้ ≤ 5:00
- [ ] อัปโหลด YouTube (Unlisted) หรือ Google Drive (ทุกคนที่มีลิงก์) → เปิดจาก incognito ได้
- [ ] สร้าง repo เปล่าบน github.com → ส่ง URL ให้ Claude เพิ่ม remote และ push
- [ ] เช็กว่าไม่มีความลับหลุด: `git log --all --oneline -- .env web/.env.local api/.env` ต้องว่าง
- [ ] ยืนยันลิงก์ canvas ยังตั้งเป็น "ทุกคนที่มีลิงก์"
- [ ] ส่งงาน
- [ ] **เตรียมคำตอบกรรมการ** (เขียนสั้น ๆ ข้อละ 2–3 บรรทัด):
  - client อ่าน access token ได้ผ่าน session — เสี่ยงอะไร รับได้เพราะอะไร
  - ทำไม `SELECT … FOR UPDATE` ที่แถวร้าน แทน unique constraint หรือ isolation `SERIALIZABLE`
  - ทำไมคำนวณค่าเฉลี่ยรีวิวสด ไม่เก็บ cache — ถ้ารีวิวเป็นล้านจะเปลี่ยนยังไง
  - ทำไมร้านรีวิว < 5 ไปท้าย แทน Bayesian average
  - ร้านข้ามเที่ยงคืนเก็บเวลายังไง · ทำไมเก็บ `timestamptz` แต่ส่งสตริงเวลาไทยให้หน้าเว็บ
  - แก้ไขการจองแล้วไม่นับที่เดิมซ้ำทำยังไง (`excludeID`)

---

## 3. ต้องมี vs ตัดได้

ถ้าเวลาไม่พอ ตัดจากบนลงล่าง — ทุกข้อตัดได้โดยไม่กระทบฟีเจอร์ที่โจทย์บังคับ `[I]`

| ลำดับตัด | ตัดอะไร | ผลกระทบ |
|---|---|---|
| 1 | P7-08 a11y pass | เสียความเรียบร้อย ไม่เสียฟีเจอร์ |
| 2 | P1-11 `callbackUrl` | login แล้วไปหน้า `/` แทนหน้าที่ตั้งใจเปิด |
| 3 | P6-02 กราฟใน dashboard | เหลือแค่ตารางการจอง |
| 4 | P4-07 bottom sheet มือถือ | ใช้ dialog ทุกขนาดจอ |
| 5 | P1-08/P2-04 หน้า `/dev/ui` | ต้องตรวจ state ในหน้าจริงแทน |

**ห้ามตัด:** ทุก ticket ของ Phase 3 · P4-02 · P4-03 · P5-01 · P5-02 · P7-01 · P7-05 — เป็นข้อบังคับของโจทย์หรือเกณฑ์ส่งงาน `[F]` HANDOFF §6, §10

---

## 4. บันทึกการเปลี่ยนแปลงของไฟล์นี้

| วันที่ | เปลี่ยนอะไร | เพราะอะไร |
|---|---|---|
| 25 ก.ย. 69 | สร้างไฟล์ · ย้าย query ค่าเฉลี่ยรีวิวจาก Phase 5 ไป P2-03 · เพิ่ม ticket app shell (P1-09) และ UI primitives (P1-08, P2-04) ที่ WALKTHROUGH ไม่ได้แยกไว้ | การ์ดร้านใน Phase 2 ต้องแสดงตราคะแนน · ทุกหน้าต้องใช้ header/tab bar |
| 25 ก.ย. 69 | เพิ่ม "ใครทำอะไร" + "งานของคุณ" ทุก phase · เช็กเครื่องมือในเครื่อง | แยกงานที่ Claude ทำแทนได้ออกจากงานที่คุณต้องทำเอง |
| 25 ก.ย. 69 | DB ใช้พอร์ต **5433** (P0-02) · `go get` jwt/bcrypt ย้ายไป Phase 1 · เพิ่ม `.gitattributes` | `wongnok-postgres` จับ 5432 · `go mod tidy` ลบ dependency ที่ยังไม่ใช้ · เครื่องแปลง CRLF จะพังสคริปต์ใน container — รายละเอียดใน [guide/phase-0.md](guide/phase-0.md) |
| | | |

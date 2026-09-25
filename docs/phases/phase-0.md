# Phase 0 — ตั้งโปรเจกต์

**ผลลัพธ์:** เปิด DB + Go API + เว็บได้ครบ · `http://localhost:3000/api/v1/health` → `{"status":"ok"}` (วิ่งผ่าน Next ไปถึง Go)

## ไฟล์หลัก

| ไฟล์ | หน้าที่ |
|---|---|
| `docker-compose.yml` | PostgreSQL 16 + healthcheck + volume |
| `.gitignore` / `.gitattributes` | กันไฟล์ลับ/ไฟล์ใหญ่ขึ้น git · บังคับท้ายบรรทัดเป็น LF |
| `api/cmd/api/main.go` | จุดเริ่มโปรแกรม Go |
| `api/internal/config/config.go` | อ่าน env พร้อมค่า default |
| `web/app/globals.css` | สี/รูปทรงจากดีไซน์ใส่ใน `@theme` ของ Tailwind |
| `web/app/layout.tsx` | ฟอนต์ Pridi + Sarabun |
| `web/next.config.ts` | rewrites `/api/v1/*` และ `/uploads/*` → Go |

## การตัดสินใจ และเหตุผล

| เรื่อง | เลือก | ทำไม | ทางอื่นที่ไม่เลือก |
|---|---|---|---|
| Database | **PostgreSQL 16** | มี `SELECT … FOR UPDATE` สำหรับกันจองซ้อน, `timestamptz` เก็บเวลาพร้อม timezone, `CHECK` constraint | SQLite: lock ทั้งไฟล์ ไม่มี row lock · MySQL: ได้ แต่ timezone จัดการยากกว่า |
| รัน DB | **Docker Compose** | คนตรวจ clone แล้ว `docker compose up` ได้เลย ไม่ต้องติดตั้ง Postgres | ติดตั้งเองในเครื่อง: เวอร์ชันไม่ตรงกัน |
| พอร์ต DB | **5433** (ไม่ใช่ 5432) | เครื่องนี้มี `wongnok-postgres` ของโปรเจกต์อื่นจับ 5432 และเปิดเองทุกครั้ง | — |
| healthcheck | `pg_isready` | Docker รู้ว่า DB "พร้อมรับคำสั่ง" จริง (ไม่ใช่แค่ container เปิด) · Phase 7 ให้ API รอจน healthy | — |
| Web framework Go | **Fiber v3** | API คล้าย Express อ่านง่าย · เร็ว · มี middleware static/recover ให้ | net/http เปล่า: ต้องเขียน routing/JSON เอง · Gin: ได้เหมือนกัน เลือก Fiber เพราะคุ้นมือ |
| ORM | **GORM** | AutoMigrate สร้างตารางจาก struct · มี `clause.Locking` ทำ `FOR UPDATE` ได้ · transaction ใช้ง่าย | sqlc/SQL ล้วน: type-safe กว่า แต่ต้องเขียน migration เอง ใช้เวลามากกว่าสำหรับงาน 2 สัปดาห์ |
| Config | env + ค่า default ในโค้ด | dev รัน `go run` ได้เลยไม่ต้องตั้ง env · Docker ส่ง env ทับได้ | ไฟล์ `.env` + lib godotenv: เพิ่ม dependency โดยไม่จำเป็น |
| `import _ "time/tzdata"` (ใน `booking/time.go`) | ฝังฐานข้อมูล timezone | กติกาการจองคิดเป็นเวลาไทย ถ้าเครื่องที่รันไม่มี tzdata (Windows, Docker alpine) `LoadLocation("Asia/Bangkok")` จะ error | ติดตั้ง tzdata ใน Docker: ต้องจำทำทุกที่ |
| `BodyLimit` 10MB | ขยายจาก 4MB | รองรับอัปโหลดรูป 5MB + ส่วนหัว multipart | — |
| Go routes ใต้ `/api/v1` | ไม่ใช้ `/api` เฉย ๆ | `/api/auth/*` เป็นของ NextAuth · ถ้า rewrite ทั้ง `/api/*` ไป Go จะชนกัน | — |
| เรียก Go ผ่าน **rewrites** ของ Next | เบราว์เซอร์คุยกับ origin เดียว | ไม่ต้องตั้ง CORS · URL ของ Go ไม่โผล่ในหน้าเว็บ · เปลี่ยนที่อยู่ API ที่ config จุดเดียว | ให้เบราว์เซอร์เรียก Go ตรง: ต้องตั้ง CORS + เปิดพอร์ต Go สู่ภายนอก |
| CSS | **Tailwind v4** | ตั้งค่าใน CSS ด้วย `@theme` → token จากดีไซน์กลายเป็น class ทันที (`--color-indigo` → `bg-indigo`) | CSS Modules: ต้องเขียน class เองทุกอย่าง |
| ฟอนต์ | **`next/font/google`** | ดาวน์โหลดตอน build แล้วเสิร์ฟจากเว็บเราเอง (ไม่ยิงไป Google ตอนผู้ใช้เปิด) · ต้องใส่ `subsets: ["thai"]` ไม่งั้นตัวไทยเป็นฟอนต์ระบบ | `<link>` ไป Google Fonts: ช้ากว่า มีกระพริบ |
| ลายไทย | `@utility bg-prajamyam` ใช้ tile SVG | ไฟล์ reference วาดลายเป็น path ยาวทั้งผืน · tile 84×126 เล็กกว่าและวางซ้ำได้ | — |
| `.gitattributes` `eol=lf` | บังคับ LF | เครื่องนี้ตั้ง Git ให้แปลงเป็น CRLF · ไฟล์ `.sh` ที่เป็น CRLF จะรันใน container Linux ไม่ได้ | — |
| Makefile | ไม่ใช้ | เครื่องไม่มี `make` · คำสั่งอยู่ใน README | — |

## ปัญหาที่เจอ

- **พอร์ต 5432 ไม่ว่าง** → เปลี่ยนเป็น 5433
- **`finalexam-db-1` ขึ้น Up แต่พอร์ตไม่ถูกเปิด** (ตอนสร้าง พอร์ตชนกับ container ทดสอบ) → `docker compose up -d --force-recreate db`
- **Go ดาวน์โหลด toolchain 1.27 ให้เอง** เพราะ `golang.org/x/crypto` ต้องการ Go ใหม่กว่าเครื่อง (1.25) → ไม่ต้องทำอะไร แต่ Dockerfile (Phase 7) ต้องใช้ image Go ที่ตรงกับ `go.mod`

## คำถามที่กรรมการอาจถาม

- **ทำไมใช้ rewrite แทน CORS?** — origin เดียวกัน ไม่ต้องตั้ง CORS, cookie ของ NextAuth ใช้ได้ตรง ๆ, Go ไม่ต้องเปิดสู่ภายนอก
- **ทำไมต้อง `time/tzdata`?** — กติกาอิงเวลาไทย ต้องได้ผลเหมือนกันทุกเครื่องที่รัน

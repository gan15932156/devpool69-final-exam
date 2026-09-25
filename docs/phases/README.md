# สรุปการพัฒนาตาม Phase — โต๊ะว่าง

แต่ละไฟล์บอกว่า phase นั้นสร้างอะไร **ทำไมทำแบบนี้ ทำไมเลือกอันนี้ ทำไมใช้ lib นี้** และทดสอบยังไง · ใช้ทบทวนก่อนอัดวิดีโอและตอบคำถามกรรมการ

| Phase | ไฟล์ | เรื่อง |
|---|---|---|
| 0 | [phase-0.md](phase-0.md) | โครงโปรเจกต์ · Docker · Tailwind tokens · rewrites |
| 1 | [phase-1.md](phase-1.md) | Models · Auth (Go JWT + NextAuth) · error กลาง |
| 2 | [phase-2.md](phase-2.md) | ร้าน · อัปโหลดรูป · สิทธิ์เจ้าของ |
| 3 | [phase-3.md](phase-3.md) | **การจอง (แกนหลัก)** · lock · ตรวจทีละช่อง 30 นาที |
| 4 | [phase-4.md](phase-4.md) | การจองของฉัน · แก้ไข · ยกเลิก |
| 5 | [phase-5.md](phase-5.md) | รีวิว · การเรียง |
| 6 | [phase-6.md](phase-6.md) | Dashboard เจ้าของร้าน |
| 7 | [phase-7.md](phase-7.md) | Seed · Docker · README |
| 8 | [phase-8.md](phase-8.md) | สคริปต์วิดีโอ · checklist ส่งงาน · คำถามกรรมการ |

## วิธีรัน

ดู [README.md](../../README.md) ที่ root (Docker: `docker compose up --build` → http://localhost:3000)

บัญชีสำหรับ present (รหัสผ่าน `toawang123`): `somchai@example.com` (ลูกค้า · การจองครบทุกสถานะ) · `mali@example.com` (เจ้าของ 3 ร้าน + เป็นลูกค้าร้านอื่น)

## ภาพรวมสถาปัตยกรรม

```
เบราว์เซอร์ ──► Next.js :3000 ──(rewrite /api/v1/*, /uploads/*)──► Go Fiber :8080 ──► PostgreSQL :5433
                  │
                  └─ /api/auth/* = NextAuth (login → เรียก Go /auth/login → เก็บ JWT ของ Go ไว้ใน session cookie)
```

- **Next.js** ทำหน้าเว็บอย่างเดียว ไม่มี business logic
- **Go** ตัดสินกติกาทุกข้อ (โจทย์บังคับ) · logic การจองอยู่ใน `api/internal/booking/` แยกจาก HTTP
- หน้าเว็บตรวจซ้ำเพื่อ UX เท่านั้น — ถ้า Go ตอบ error ต้องแสดงตามที่ Go บอกเสมอ

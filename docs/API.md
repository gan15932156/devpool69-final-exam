# ตึกตึกโต๊ะ — API Reference (Go)

API ของ Go ทั้งหมด · โค้ดอยู่ที่ [api/internal/handlers/](../api/internal/handlers/) · ตัวอย่างยิงจริงทุก endpoint อยู่ที่ [api/requests.http](../api/requests.http)

**Swagger UI:** เปิด API แล้วเข้า http://localhost:8080/docs กดลองยิงได้ทุก endpoint · spec อยู่ที่ [api/internal/apidocs/openapi.yaml](../api/internal/apidocs/openapi.yaml) — **แก้ API แล้วต้องแก้ spec และไฟล์นี้ตามด้วย**

## พื้นฐาน

| เรื่อง | ค่า |
|---|---|
| Base URL | `http://localhost:8080/api/v1` |
| รูปแบบข้อมูล | JSON (`Content-Type: application/json`) · ยกเว้นอัปโหลดรูปใช้ `multipart/form-data` |
| เขตเวลา | **เวลาไทย (Asia/Bangkok) ทุกจุด** · วันที่ `YYYY-MM-DD` · เวลา `HH:MM` (24 ชม.) |
| ขนาด body สูงสุด | 10MB (เกิน → `413 PAYLOAD_TOO_LARGE`) |

### การยืนยันตัวตน

ส่ง token ที่ได้จาก `/auth/register` หรือ `/auth/login` ใน header:

```
Authorization: Bearer <accessToken>
```

- JWT แบบ HS256 · อายุ 7 วัน · `sub` = id ผู้ใช้
- คอลัมน์ **Auth** ในตารางด้านล่าง:
  - **ต้อง** = ไม่มี token หรือ token ผิด/หมดอายุ → `401 UNAUTHORIZED`
  - **ไม่บังคับ** = ไม่ส่งก็ได้ แต่ถ้าส่งมา ผลลัพธ์จะรู้ว่าเป็นใคร (เช่น `isMine`, `mine`)
  - **–** = ไม่ต้องใช้
- สิทธิ์เจ้าของร้าน/เจ้าของการจองตรวจที่ API ทุกครั้ง ไม่ใช่เจ้าของ → `403 FORBIDDEN`

### รูปแบบ error

ทุก error ตอบหน้าตาเดียวกัน ([api/internal/apperr/apperr.go](../api/internal/apperr/apperr.go)):

```json
{
  "error": {
    "code": "VALIDATION",
    "message": "ข้อมูลไม่ถูกต้อง",
    "details": { "email": "รูปแบบอีเมลไม่ถูกต้อง" }
  }
}
```

- หน้าเว็บควรตัดสินจาก `code` · `message` เป็นข้อความภาษาไทยพร้อมแสดง
- `details` เป็น `null` ถ้าไม่มีข้อมูลเพิ่ม · สำหรับ `VALIDATION` คือ `{ "ชื่อช่อง": "ข้อความ" }`

| HTTP | `code` | เกิดเมื่อ |
|---|---|---|
| 400 | `VALIDATION` | ข้อมูลผิด (มี `details` บอกช่อง) หรือ JSON อ่านไม่ได้ (`details: null`) |
| 400 | `INVALID_SLOT` | เวลาจองไม่ลงที่ :00 / :30 |
| 400 | `INVALID_RANGE` | เวลาสิ้นสุดไม่อยู่หลังเวลาเริ่ม |
| 400 | `OUTSIDE_HOURS` | นอกเวลาเปิดร้าน · `details: { open, close }` |
| 400 | `IN_PAST` | เวลาเริ่มผ่านไปแล้ว |
| 400 | `UNSUPPORTED_FILE` | ไฟล์ไม่ใช่ JPG/PNG/WEBP หรือเกิน 5MB |
| 401 | `UNAUTHORIZED` | ไม่ได้ login · token ผิด · อีเมล/รหัสผ่านผิด |
| 403 | `FORBIDDEN` | ไม่ใช่เจ้าของร้าน/เจ้าของการจอง |
| 403 | `OWN_RESTAURANT` | รีวิวร้านของตัวเอง |
| 404 | `NOT_FOUND` | ไม่พบร้าน/การจอง · `:id` ไม่ใช่ตัวเลข · ไม่มี route นี้ |
| 405 | `METHOD_NOT_ALLOWED` | method ไม่ตรงกับ route |
| 409 | `EMAIL_TAKEN` | อีเมลนี้มีบัญชีแล้ว |
| 409 | `SEATS_EXCEEDED` | ที่นั่งไม่พอ · ดู [details](#seats_exceeded) |
| 409 | `CANCEL_WINDOW_PASSED` | เลยเวลาที่ร้านให้แก้ไข/ยกเลิก |
| 409 | `BOOKING_CANCELLED` | การจองถูกยกเลิกไปแล้ว |
| 409 | `HAS_FUTURE_BOOKINGS` | ลบร้านที่ยังมีการจองไม่จบ · `details: { count }` |
| 413 | `PAYLOAD_TOO_LARGE` | body เกิน 10MB |
| 500 | `INTERNAL` | bug ฝั่ง server (รายละเอียดอยู่ใน log ไม่ส่งออกมา) |

## สรุป endpoint

| Method | Path | Auth | ทำอะไร |
|---|---|---|---|
| GET | `/health` | – | เช็กว่า API ทำงาน |
| POST | `/auth/register` | – | สมัครสมาชิก |
| POST | `/auth/login` | – | เข้าสู่ระบบ |
| GET | `/me` | ต้อง | ข้อมูลผู้ใช้ที่ login |
| GET | `/restaurants` | – | ค้นหา/เรียงร้าน |
| GET | `/restaurants/:id` | – | รายละเอียดร้าน + การกระจายดาว |
| POST | `/restaurants` | ต้อง | สร้างร้าน (คนสร้าง = เจ้าของ) |
| PUT | `/restaurants/:id` | ต้อง · เจ้าของ | แก้ร้าน |
| DELETE | `/restaurants/:id` | ต้อง · เจ้าของ | ลบร้าน |
| GET | `/me/restaurants` | ต้อง | ร้านของฉัน |
| POST | `/uploads` | ต้อง | อัปโหลดรูปร้าน |
| GET | `/restaurants/:id/availability` | ไม่บังคับ | ที่นั่งที่ถูกจองทีละช่อง 30 นาที |
| POST | `/restaurants/:id/bookings` | ต้อง | จองโต๊ะ |
| GET | `/me/bookings` | ต้อง | การจองของฉัน |
| PUT | `/bookings/:id` | ต้อง · เจ้าของการจอง | แก้ไขการจอง |
| POST | `/bookings/:id/cancel` | ต้อง · เจ้าของการจอง | ยกเลิกการจอง |
| GET | `/restaurants/:id/reviews` | ไม่บังคับ | รีวิวของร้าน (ทีละ 20) |
| PUT | `/restaurants/:id/reviews/me` | ต้อง | เขียน/แก้รีวิวของฉัน |
| GET | `/restaurants/:id/bookings` | ต้อง · เจ้าของ | รายการจองของร้านในวันหนึ่ง (dashboard) |
| GET | `/uploads/<ชื่อไฟล์>` | – | ไฟล์รูป (**ไม่มี** `/api/v1` นำหน้า) |

---

## บัญชี

### `POST /auth/register`

```json
{ "name": "สมชาย ใจดี", "email": "somchai@example.com", "password": "toawang123" }
```

| ช่อง | กติกา |
|---|---|
| `name` | ห้ามว่าง (ตัดช่องว่างหน้า-หลัง) |
| `email` | รูปแบบอีเมลถูกต้อง · เก็บเป็นตัวพิมพ์เล็ก |
| `password` | อย่างน้อย 8 ตัว · มีตัวเลขอย่างน้อย 1 ตัว · ไม่เกิน 72 byte |

**201** → `AuthResponse`

```json
{
  "user": { "id": 2, "name": "สมชาย ใจดี", "email": "somchai@example.com", "createdAt": "2026-10-06T10:00:00+07:00" },
  "accessToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

Error: `400 VALIDATION` (`name` / `email` / `password`) · `409 EMAIL_TAKEN`

### `POST /auth/login`

```json
{ "email": "somchai@example.com", "password": "toawang123" }
```

**200** → `AuthResponse` (หน้าตาเดียวกับ register)

Error: `401 UNAUTHORIZED` "อีเมลหรือรหัสผ่านไม่ถูกต้อง" — ไม่แยกว่าผิดที่อีเมลหรือรหัสผ่าน เพื่อไม่ให้เดาได้ว่าใครมีบัญชี

### `GET /me`

**200** → `User` `{ id, name, email, createdAt }` · ไม่มี password hash ออกมาเด็ดขาด

Error: `401` (รวมกรณี token ถูกแต่ผู้ใช้ถูกลบไปแล้ว)

---

## ร้าน

### Restaurant (ข้อมูลที่ตอบกลับ)

```json
{
  "id": 4,
  "ownerId": 1,
  "name": "ข้าวต้มโต้รุ่งท่าน้ำ",
  "cuisine": "ข้าวต้ม กับข้าว · โต้รุ่ง",
  "description": "...",
  "seats": 20,
  "openTime": "18:00",
  "closeTime": "02:00",
  "crossesMidnight": true,
  "cancelLeadMinutes": 60,
  "images": ["/uploads/seed-khao-tom-tha-nam-1.jpg", "/uploads/seed-khao-tom-tha-nam-2.jpg"],
  "avgRating": 4.5,
  "reviewCount": 42,
  "hasEnoughReviews": true
}
```

| ช่อง | ความหมาย |
|---|---|
| `crossesMidnight` | `closeTime <= openTime` = ปิดหลังเที่ยงคืนของวันถัดไป |
| `avgRating` | ค่าเฉลี่ยทศนิยม 1 ตำแหน่ง คำนวณสดจากตารางรีวิว · `null` = ยังไม่มีรีวิว |
| `hasEnoughReviews` | `reviewCount >= 5` · ไม่ถึง = ป้าย "รีวิวยังน้อย" |
| `images` | URL ตามลำดับที่เจ้าของจัดไว้ · ไม่มีรูป = `[]` |

### `GET /restaurants?q=&sort=`

| Query | ค่า |
|---|---|
| `q` | ค้นในชื่อร้านและประเภทอาหาร (ไม่สนตัวพิมพ์เล็ก/ใหญ่) |
| `sort` | `rating` (ค่าเริ่มต้น) หรือ `reviews` · ค่าอื่น → `400 VALIDATION` |

- `rating`: ร้านที่รีวิวถึง 5 ขึ้นก่อน → คะแนนสูง → รีวิวเยอะ · ร้าน 5.0 จาก 1 รีวิว จึงไม่แซง 4.8 จาก 126 รีวิว
- `reviews`: จำนวนรีวิวมาก → คะแนนสูง

**200** → `Restaurant[]` (ไม่แบ่งหน้า)

### `GET /restaurants/:id`

**200** → `Restaurant` + `distribution` จำนวนรีวิวแต่ละดาว (key เป็นสตริง มีครบ 1–5 เสมอ)

```json
{ "...": "...", "distribution": { "1": 0, "2": 1, "3": 3, "4": 18, "5": 104 } }
```

Error: `404`

### `POST /restaurants` · `PUT /restaurants/:id`

body เดียวกันทั้งคู่ · `PUT` เป็นการแทนที่ทั้งก้อน ต้องส่งทุกช่อง และรูปจะถูกแทนด้วยชุดใหม่ตามลำดับที่ส่ง

```json
{
  "name": "ครัวริมคลอง",
  "cuisine": "อาหารไทย",
  "description": "...",
  "seats": 10,
  "openTime": "11:00",
  "closeTime": "22:00",
  "cancelLeadMinutes": 60,
  "images": ["/uploads/3f9a...c1.jpg"]
}
```

| ช่อง | กติกา |
|---|---|
| `name` | 1–100 ตัวอักษร |
| `cuisine` | ไม่เกิน 100 ตัวอักษร (ว่างได้) |
| `description` | ไม่เกิน 2,000 ตัวอักษร (ว่างได้) |
| `seats` | ≥ 1 |
| `openTime`, `closeTime` | `HH:MM` ลงที่ :00 หรือ :30 · ห้ามเท่ากัน · ปิด < เปิด = ข้ามเที่ยงคืน |
| `cancelLeadMinutes` | ≥ 30 |
| `images` | 1–8 รูป · ต้องเป็น URL ที่ได้จาก `POST /uploads` (ขึ้นต้น `/uploads/`) |

**201** (สร้าง) / **200** (แก้) → `Restaurant` + `distribution`

Error: `400 VALIDATION` · `403 FORBIDDEN` (PUT ร้านคนอื่น) · `404`

> แก้จำนวนที่นั่งหรือเวลาเปิดแล้ว **การจองที่มีอยู่ไม่ถูกแตะ** · กติกาใหม่ใช้กับการจอง/แก้ไขครั้งถัดไป

### `DELETE /restaurants/:id`

**204** ไม่มี body · รูป การจองเก่า และรีวิวของร้านถูกลบตามด้วย

Error: `403` · `404` · `409 HAS_FUTURE_BOOKINGS` `details: { "count": 3 }` เมื่อยังมีการจองที่ยืนยันแล้วและยังไม่จบ

### `GET /me/restaurants`

**200** → `Restaurant[]` ของร้านที่ฉันเป็นเจ้าของ เรียงตาม id

### `POST /uploads`

`multipart/form-data` ช่องชื่อ `file`

- รับ JPG / PNG / WEBP ไม่เกิน 5MB · ตรวจชนิดจากเนื้อไฟล์จริง ไม่ดูนามสกุล
- ตั้งชื่อไฟล์ใหม่แบบสุ่ม ไม่ใช้ชื่อที่ส่งมา

**201**

```json
{ "url": "/uploads/3f9a0b7e4c2d1a6f8e5b9c0d7a1e2f3c.jpg" }
```

Error: `400 VALIDATION` (`file` ไม่ได้แนบ) · `400 UNSUPPORTED_FILE`

---

## การจอง

### หลักเรื่องเวลา

- ลูกค้ากรอก **วันที่ของรอบ + เวลาเริ่ม + เวลาสิ้นสุด + จำนวนคน** · ไม่มีระยะเวลาตายตัว
- เวลาต้องลงที่ :00 / :30 · ที่นั่งนับทีละช่อง 30 นาที ทุกช่องในช่วงที่จองต้อง `จองแล้ว + คนที่ขอ ≤ seats`
- **ร้านข้ามเที่ยงคืน**: `date` คือวันของรอบ · เวลาที่ ≤ `closeTime` นับเป็นของวันถัดไป
  ตัวอย่าง ร้าน 18:00–02:00 `{ "date": "2026-09-25", "start": "23:00", "end": "01:30" }` = 25 ก.ย. 23:00 ถึง 26 ก.ย. 01:30
- แก้ไข/ยกเลิกได้ถึง `เวลาเริ่ม − cancelLeadMinutes` ของร้าน

### Booking (ข้อมูลที่ตอบกลับ)

```json
{
  "id": 12,
  "restaurantId": 1,
  "restaurantName": "ครัวริมคลอง",
  "partySize": 2,
  "serviceDate": "2026-10-07",
  "start": "14:00",
  "end": "15:00",
  "status": "confirmed",
  "cancelDeadline": "13:00",
  "cancelDeadlineDate": "2026-10-07",
  "cancelLeadMinutes": 60,
  "canCancel": true,
  "hasReviewed": false
}
```

| ช่อง | ความหมาย |
|---|---|
| `status` | `confirmed` หรือ `cancelled` |
| `cancelDeadline`, `cancelDeadlineDate` | เวลาสุดท้ายที่ยังแก้ไข/ยกเลิกได้ |
| `canCancel` | ตอนนี้ยังแก้ไข/ยกเลิกได้ไหม · ใช้กติกาเดียวกับที่ API ตัดสินจริง |
| `hasReviewed` | เคยรีวิวร้านนี้แล้วหรือยัง · **มีค่าจริงเฉพาะใน `GET /me/bookings`** endpoint อื่นเป็น `false` เสมอ |

### BookingInput (body ของจองและแก้ไข)

```json
{ "date": "2026-10-07", "start": "14:00", "end": "15:00", "partySize": 2 }
```

ตรวจตามลำดับนี้ เจอข้อแรกที่ผิดก็ตอบเลย:

| ลำดับ | ตรวจ | ผิด → |
|---|---|---|
| 1 | `date` เป็น `YYYY-MM-DD` | `400 VALIDATION` `{ date }` |
| 2 | `start`, `end` เป็น `HH:MM` | `400 VALIDATION` `{ start }` |
| 3 | ลงที่ :00 / :30 | `400 INVALID_SLOT` |
| 4 | สิ้นสุดอยู่หลังเริ่ม | `400 INVALID_RANGE` |
| 5 | อยู่ในเวลาเปิดของรอบนั้น | `400 OUTSIDE_HOURS` `{ open, close }` |
| 6 | เวลาเริ่มยังไม่ผ่านไป | `400 IN_PAST` |
| 7 | `partySize` ≥ 1 | `400 VALIDATION` `{ partySize }` |
| 8 | ที่นั่งพอทุกช่อง 30 นาที | `409 SEATS_EXCEEDED` |

<a id="seats_exceeded"></a>`SEATS_EXCEEDED` บอกช่องแรกที่เกิน ให้หน้าเว็บเขียนข้อความเอง:

```json
{
  "error": {
    "code": "SEATS_EXCEEDED",
    "message": "ที่นั่งไม่พอ",
    "details": { "slotStart": "12:00", "slotEnd": "12:30", "used": 10, "party": 2, "seats": 10 }
  }
}
```

### `GET /restaurants/:id/availability?date=&excludeBookingId=`

ที่นั่งที่ถูกจองในแต่ละช่อง 30 นาทีตลอดเวลาเปิดของรอบ · ใช้ฟังก์ชันนับเดียวกับตอนตัดสินการจอง ตัวเลขจึงตรงกันเสมอ

| Query | ค่า |
|---|---|
| `date` | `YYYY-MM-DD` · ไม่ส่ง = วันนี้ (เวลาไทย) |
| `excludeBookingId` | ใช้ตอนแก้ไข: ไม่นับที่นั่งของการจองนี้ · มีผลเฉพาะการจองของคนที่ login อยู่ ถ้าไม่ใช่จะถูกเมินเงียบ ๆ |

**200**

```json
{
  "date": "2026-10-07",
  "seats": 10,
  "slots": [
    { "start": "11:00", "used": 0, "past": false },
    { "start": "11:30", "used": 4, "past": false }
  ]
}
```

`past: true` = ช่องนี้จบไปแล้ว

Error: `400 VALIDATION` `{ date }` · `404`

### `POST /restaurants/:id/bookings`

body: `BookingInput` · **201** → `Booking`

Error: ตามตาราง BookingInput · `404`

> สองคนจองที่นั่งสุดท้ายพร้อมกัน: API ล็อกแถวร้าน (`SELECT … FOR UPDATE`) คนหนึ่งได้ `201` อีกคนได้ `409 SEATS_EXCEEDED` เสมอ · ทดสอบด้วย `bash api/scripts/race.sh`

### `GET /me/bookings`

**200**

```json
{
  "upcoming":  [ /* Booking: ยืนยันแล้ว ยังไม่จบ · ใกล้ → ไกล */ ],
  "past":      [ /* Booking: ยืนยันแล้ว จบแล้ว · ล่าสุดก่อน */ ],
  "cancelled": [ /* Booking: ยกเลิกแล้ว · ล่าสุดก่อน */ ]
}
```

ทุกช่องเป็น array เสมอ (ว่าง = `[]`)

### `PUT /bookings/:id`

body: `BookingInput` · กติกาเดียวกับจองใหม่ แต่ไม่นับที่นั่งเดิมของการจองนี้ซ้ำ
ตัวอย่าง ร้าน 10 ที่ · A จอง 7 · B จอง 3 → A แก้เป็น 8: 3 + 8 = 11 ✕ · A แก้เป็น 5: 3 + 5 = 8 ✓

**200** → `Booking`

Error (ตรวจก่อน BookingInput): `404` · `403 FORBIDDEN` · `409 BOOKING_CANCELLED` · `409 CANCEL_WINDOW_PASSED` · แล้วตามด้วยตาราง BookingInput

### `POST /bookings/:id/cancel`

ไม่มี body · **200** → `Booking` ที่ `status: "cancelled"` · ที่นั่งคืนให้ร้านทันที

Error: `404` · `403 FORBIDDEN` · `409 BOOKING_CANCELLED` · `409 CANCEL_WINDOW_PASSED`

### `GET /restaurants/:id/bookings?date=` (เจ้าของร้าน)

`date` **ต้องส่ง** (`YYYY-MM-DD`) · กรองตามวันของรอบ → ร้านโต้รุ่ง การจอง 01:00 ของคืนวันที่ 25 อยู่ในรายการวันที่ 25 · รวมทั้งที่ยืนยันและยกเลิกแล้ว เรียงตามเวลาเริ่ม

**200**

```json
[
  { "id": 31, "customerName": "สมชาย ใจดี", "partySize": 7, "start": "12:00", "end": "13:00", "status": "confirmed" }
]
```

Error: `400 VALIDATION` `{ date }` · `403` · `404`

---

## รีวิว

### Review (ข้อมูลที่ตอบกลับ)

```json
{
  "id": 501,
  "rating": 5,
  "comment": "อร่อยมาก",
  "userName": "สมชาย ใจดี",
  "isMine": true,
  "createdAt": "2026-10-01T19:20:00+07:00",
  "updatedAt": "2026-10-01T19:20:00+07:00"
}
```

### `GET /restaurants/:id/reviews?offset=`

ทีละ 20 รายการ เรียงที่แก้ล่าสุดก่อน · `offset` เริ่มที่ `0`

**200**

```json
{ "total": 126, "items": [ /* Review */ ], "mine": null }
```

`mine` = รีวิวของคนที่ login อยู่ · ส่งมาเฉพาะหน้าแรก (`offset=0`) · ไม่ได้ login / ยังไม่รีวิว / หน้าถัดไป → `null`

Error: `404`

### `PUT /restaurants/:id/reviews/me`

1 คน 1 รีวิวต่อร้าน · ส่งซ้ำ = แก้รีวิวเดิม · ไม่ต้องเคยจองมาก่อน

```json
{ "rating": 4, "comment": "บรรยากาศดี" }
```

| ช่อง | กติกา |
|---|---|
| `rating` | จำนวนเต็ม 1–5 · ทศนิยม (เช่น 3.5) → `400 VALIDATION` `details: null` |
| `comment` | ไม่เกิน 1,000 ตัวอักษร (ว่างได้) |

**200** → `Review`

Error: `400 VALIDATION` · `403 OWN_RESTAURANT` (เจ้าของรีวิวร้านตัวเอง) · `404`

---

## อื่น ๆ

### `GET /health`

**200** `{ "status": "ok" }`

### `GET /uploads/<ชื่อไฟล์>`

ไฟล์รูปจากโฟลเดอร์ `UPLOAD_DIR` · path อยู่นอก `/api/v1` เช่น `http://localhost:8080/uploads/3f9a...c1.jpg`

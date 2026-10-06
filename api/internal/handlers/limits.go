package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/limiter"

	"toawang/internal/apperr"
	"toawang/internal/middleware"
)

// ค่าจำกัดที่กันการใช้งานในทางผิด รวมไว้ที่เดียว · เปลี่ยนแล้วแก้ schema/mock ฝั่งเว็บให้ตรงด้วย
const (
	MaxNameLength        = 100            // ชื่อที่แสดง (ตัวอักษร) · ไม่จำกัด = ชื่อยาวหลาย MB ไปโผล่ในรายการรีวิวทุกหน้า
	MaxSeats             = 1000           // ที่นั่งต่อร้าน
	MaxCancelLeadMinutes = 7 * 24 * 60    // ยกเลิกล่วงหน้าได้นานสุด 7 วัน
	MaxActiveBookings    = 30             // การจองที่ยังไม่ถึงเวลาต่อคน · กันบัญชีเดียวกวาดที่นั่งทุกร้าน
	OrphanUploadAge      = 24 * time.Hour // รูปที่ไม่มีร้านไหนใช้ เก็บไว้นานเท่านี้ก่อนลบ (เผื่อกำลังกรอกฟอร์มร้านอยู่)
)

var errTooManyRequests = apperr.New(http.StatusTooManyRequests, "TOO_MANY_REQUESTS", "ทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่")

// rateLimit นับคำขอต่อ key ภายในช่วง window · เกิน max → 429 TOO_MANY_REQUESTS
// failedOnly = นับเฉพาะคำขอที่ไม่ผ่าน (status ≥ 400) · ตัวนับอยู่ในหน่วยความจำของ API (รันตัวเดียว)
func rateLimit(max int, window time.Duration, key func(fiber.Ctx) string, failedOnly bool) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:                    max,
		Expiration:             window,
		KeyGenerator:           key,
		SkipSuccessfulRequests: failedOnly,
		LimitReached:           func(fiber.Ctx) error { return errTooManyRequests },
	})
}

// byUser นับต่อบัญชี · ใช้หลัง RequireAuth เท่านั้น
func byUser(c fiber.Ctx) string {
	return "user:" + strconv.FormatUint(uint64(middleware.UserID(c)), 10)
}

// byLoginEmail นับ login ที่ผิดต่ออีเมล ไม่ใช่ต่อ IP
// เพราะ login จากหน้าเว็บมาจาก server ของ Next (NextAuth) ทั้งหมด → IP เดียวกันหมด
func byLoginEmail(c fiber.Ctx) string {
	var req loginRequest
	_ = json.Unmarshal(c.Body(), &req)
	return "login:" + normalizeEmail(req.Email)
}

// byIP นับต่อ IP ผู้ใช้ (จาก X-Forwarded-For ที่ Next ส่งต่อมา) · ปลอม header ได้ จึงต้องมีเพดานรวมอีกชั้น
func byIP(c fiber.Ctx) string { return "ip:" + c.IP() }

func everyone(fiber.Ctx) string { return "all" }

// limits = rate limit ของแต่ละกลุ่ม route (ใช้ใน Routes)
type limits struct {
	login, register, registerAll, write, upload fiber.Handler
}

func newLimits() limits {
	return limits{
		login:       rateLimit(10, 15*time.Minute, byLoginEmail, true), // เดารหัสผ่านอีเมลเดียวได้ 10 ครั้ง / 15 นาที
		register:    rateLimit(10, time.Hour, byIP, false),
		registerAll: rateLimit(100, time.Hour, everyone, false), // เพดานรวมทั้งระบบ เผื่อมีคนปลอม IP
		write:       rateLimit(60, time.Minute, byUser, false),
		upload:      rateLimit(30, 10*time.Minute, byUser, false), // 5MB × 30 = ไม่เกิน 150MB ต่อคนต่อ 10 นาที
	}
}

package main

import (
	"log"
	"time"

	"github.com/gofiber/fiber/v3"
	recoverer "github.com/gofiber/fiber/v3/middleware/recover"

	"toawang/internal/apperr"
	"toawang/internal/config"
	"toawang/internal/database"
	"toawang/internal/handlers"
	"toawang/internal/seed"
)

func main() {
	cfg := config.Load()

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect database: %v", err)
	}
	// SEED_ON_START=reset (ค่า default) → ล้างทุกตารางแล้ว seed ใหม่ทุกครั้งที่เริ่ม
	// การจองตัวอย่างนับจาก "ตอนนี้" เสมอ → เปิด dev/Docker เมื่อไหร่ ข้อมูลก็พร้อม present
	if cfg.SeedOnStart == "reset" {
		if err := seed.Reset(db); err != nil {
			log.Fatalf("seed reset: %v", err)
		}
	}
	if err := database.Migrate(db); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	// "true" = seed เฉพาะตอน DB ว่าง (มีข้อมูลแล้วจะข้าม) · "false" = ไม่แตะข้อมูล
	if cfg.SeedOnStart == "reset" || cfg.SeedOnStart == "true" {
		if err := seed.EnsureImages(cfg.UploadDir); err != nil {
			log.Fatalf("seed images: %v", err)
		}
		if err := seed.Run(db, cfg.UploadDir); err != nil {
			log.Fatalf("seed: %v", err)
		}
	}

	// กุญแจเซ็น JWT: ตั้ง JWT_SECRET เอง (≥ 32 ตัวอักษร) หรือไม่ตั้ง → ใช้กุญแจที่สุ่มเก็บไว้ใน DB
	// ไม่มีค่า default ที่เขียนไว้ใน repo อีกแล้ว เพราะใครอ่าน repo ก็ปลอม token เป็นผู้ใช้คนไหนก็ได้
	secret := []byte(cfg.JWTSecret)
	switch {
	case len(secret) == 0:
		if secret, err = database.JWTSecret(db); err != nil {
			log.Fatalf("jwt secret: %v", err)
		}
	case len(secret) < 32:
		log.Fatal("JWT_SECRET สั้นเกินไป ต้องยาวอย่างน้อย 32 ตัวอักษร (หรือไม่ต้องตั้ง แล้วระบบจะสุ่มเก็บไว้ใน DB)")
	}

	app := fiber.New(fiber.Config{
		BodyLimit:    10 * 1024 * 1024, // 10MB — default 4MB ไม่พอสำหรับอัปโหลดรูป
		ErrorHandler: apperr.Handler,   // ทุก error ตอบรูปแบบเดียวกัน
		// คำขอจากหน้าเว็บผ่าน server ของ Next ก่อนถึง Go → IP ผู้ใช้อยู่ใน X-Forwarded-For
		// เชื่อ header นี้เฉพาะคำขอจากเครื่องเดียวกัน/เครือข่ายภายใน (Next ใน Docker) · ใช้แค่นับ rate limit
		ProxyHeader:        fiber.HeaderXForwardedFor,
		TrustProxy:         true,
		TrustProxyConfig:   fiber.TrustProxyConfig{Loopback: true, Private: true},
		EnableIPValidation: true,
	})
	app.Use(recoverer.New()) // handler panic → กลายเป็น 500 แทนที่ server จะล่ม

	h := &handlers.Handler{
		DB:        db,
		JWTSecret: secret,
		UploadDir: cfg.UploadDir,
		Now:       time.Now,
	}
	h.Routes(app)
	go h.CleanUploads(time.Hour) // ลบรูปที่อัปโหลดทิ้งไว้แล้วไม่มีร้านไหนใช้

	log.Fatal(app.Listen(":" + cfg.Port))
}

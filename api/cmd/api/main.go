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

	app := fiber.New(fiber.Config{
		BodyLimit:    10 * 1024 * 1024, // 10MB — default 4MB ไม่พอสำหรับอัปโหลดรูป
		ErrorHandler: apperr.Handler,   // ทุก error ตอบรูปแบบเดียวกัน
	})
	app.Use(recoverer.New()) // handler panic → กลายเป็น 500 แทนที่ server จะล่ม

	h := &handlers.Handler{
		DB:        db,
		JWTSecret: []byte(cfg.JWTSecret),
		UploadDir: cfg.UploadDir,
		Now:       time.Now,
	}
	h.Routes(app)

	log.Fatal(app.Listen(":" + cfg.Port))
}

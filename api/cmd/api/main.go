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
	if err := database.Migrate(db); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	// Docker ตั้ง SEED_ON_START=true → เปิดครั้งแรก (DB ว่าง) มีข้อมูลตัวอย่างทันที · มีข้อมูลแล้วจะข้าม
	if cfg.SeedOnStart {
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

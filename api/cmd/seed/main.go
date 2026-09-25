package main

import (
	"flag"
	"log"

	"toawang/internal/config"
	"toawang/internal/database"
	"toawang/internal/seed"
)

// go run ./cmd/seed          ใส่ข้อมูลตัวอย่าง (ถ้า DB ว่าง)
// go run ./cmd/seed -reset   ล้างทุกตารางแล้วใส่ใหม่ (การจองนับจากวันนี้ใหม่)
func main() {
	reset := flag.Bool("reset", false, "ลบข้อมูลทั้งหมดแล้ว seed ใหม่")
	flag.Parse()

	cfg := config.Load()
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect database: %v", err)
	}
	if *reset {
		if err := seed.Reset(db); err != nil {
			log.Fatalf("reset: %v", err)
		}
	}
	if err := database.Migrate(db); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	if err := seed.Run(db, cfg.UploadDir); err != nil {
		log.Fatalf("seed: %v", err)
	}
}

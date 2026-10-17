// Package testdb เปิด Postgres สำหรับ integration test · ใช้จากไฟล์ _test.go เท่านั้น
//
// แต่ละ package ได้ database ของตัวเอง (toawang_test_<name>) บน server เดียวกับ DB dev
// → ไม่แตะข้อมูล dev และ go test ./... ที่รันหลาย package พร้อมกันไม่ล้างข้อมูลของกันและกัน
// ต่อ DB ไม่ได้ (ยังไม่ได้ docker compose up db) → test ที่ต้องใช้ DB ถูก skip ไม่ fail
package testdb

import (
	"fmt"
	"net/url"
	"os"
	"sync"
	"testing"

	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"toawang/internal/database"
)

// ค่า default = DB dev ใน docker-compose.yml · ชี้ไปที่อื่นได้ด้วย TEST_DATABASE_URL (ต้องมีสิทธิ์ CREATE DATABASE)
const devURL = "postgres://toawang:toawang@localhost:5433/toawang?sslmode=disable"

var (
	mu    sync.Mutex
	conns = map[string]*gorm.DB{}
)

// Open คืน DB ที่ migrate แล้วและล้างข้อมูลทุกตาราง (ทุก test เริ่มจาก DB ว่าง)
func Open(t testing.TB, name string) *gorm.DB {
	t.Helper()
	mu.Lock()
	defer mu.Unlock()

	db, ok := conns[name]
	if !ok {
		var err error
		if db, err = setup(name); err != nil {
			t.Skipf("ข้าม integration test (ต่อ Postgres ไม่ได้ · docker compose up -d db หรือตั้ง TEST_DATABASE_URL): %v", err)
		}
		conns[name] = db
	}
	// app_secrets ไม่ต้องล้าง · CASCADE ล้างตารางที่อ้างถึงตามไปด้วย · RESTART IDENTITY = id เริ่มที่ 1 ทุก test
	if err := db.Exec("TRUNCATE users, restaurants, restaurant_images, bookings, reviews RESTART IDENTITY CASCADE").Error; err != nil {
		t.Fatalf("truncate: %v", err)
	}
	return db
}

func setup(name string) (*gorm.DB, error) {
	base := os.Getenv("TEST_DATABASE_URL")
	if base == "" {
		base = devURL
	}
	u, err := url.Parse(base)
	if err != nil {
		return nil, err
	}
	dbName := "toawang_test_" + name

	admin, err := database.Connect(base)
	if err != nil {
		return nil, err
	}
	var exists bool
	if err := admin.Raw("SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = ?)", dbName).Scan(&exists).Error; err != nil {
		return nil, err
	}
	if !exists {
		// ชื่อมาจากโค้ด test เอง ไม่ใช่จากผู้ใช้ · CREATE DATABASE ใช้ placeholder ไม่ได้
		if err := admin.Exec(fmt.Sprintf(`CREATE DATABASE "%s"`, dbName)).Error; err != nil {
			return nil, err
		}
	}
	if sqlDB, err := admin.DB(); err == nil {
		sqlDB.Close()
	}

	u.Path = "/" + dbName
	db, err := database.Connect(u.String())
	if err != nil {
		return nil, err
	}
	db.Logger = logger.Default.LogMode(logger.Silent) // test ที่ตั้งใจให้ "record not found" ไม่ต้องพิมพ์ log
	if err := database.Migrate(db); err != nil {
		return nil, err
	}
	return db, nil
}

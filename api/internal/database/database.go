package database

import (
	"crypto/rand"
	"encoding/hex"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"toawang/internal/models"
)

// Connect เปิดการเชื่อมต่อ PostgreSQL
// gorm.Open จะ ping DB ให้ด้วย ถ้า DB ยังไม่เปิดจะได้ error ตรงนี้เลย
// TranslateError: true → error จาก Postgres ถูกแปลงเป็น error ของ GORM เช่น อีเมลซ้ำ = gorm.ErrDuplicatedKey
func Connect(url string) (*gorm.DB, error) {
	return gorm.Open(postgres.Open(url), &gorm.Config{TranslateError: true})
}

// Migrate สร้าง/อัปเดตตารางตาม struct ใน models (เรียงตาม foreign key: ตารางที่ถูกอ้างถึงต้องมาก่อน)
// ใช้ AutoMigrate แทนไฟล์ migration SQL → schema อยู่ที่ struct ใน models ที่เดียว พอสำหรับโปรเจกต์ขนาดนี้
// ข้อจำกัด: เพิ่มตาราง/คอลัมน์/index ให้เอง แต่ไม่ลบคอลัมน์ที่เลิกใช้แล้ว
func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.User{},
		&models.Restaurant{},
		&models.RestaurantImage{},
		&models.Booking{},
		&models.Review{},
		&models.AppSecret{},
	)
}

// JWTSecret คืนกุญแจเซ็น JWT ที่สุ่มเก็บไว้ใน DB (ครั้งแรกสุ่มใหม่ 32 byte) · ใช้ตอนไม่ได้ตั้ง JWT_SECRET
// ไม่มีค่า default ที่ใครก็รู้ → ปลอม token ไม่ได้ · เก็บใน DB → restart แล้ว login เดิมยังใช้ได้
func JWTSecret(db *gorm.DB) ([]byte, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return nil, err
	}
	// มีอยู่แล้ว → ไม่ทับ (API หลายตัวเริ่มพร้อมกันก็ได้กุญแจเดียวกัน)
	if err := db.Clauses(clause.OnConflict{DoNothing: true}).
		Create(&models.AppSecret{Name: "jwt", Value: hex.EncodeToString(b)}).Error; err != nil {
		return nil, err
	}
	var s models.AppSecret
	if err := db.First(&s, "name = ?", "jwt").Error; err != nil {
		return nil, err
	}
	return []byte(s.Value), nil
}

package database

import (
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"toawang/internal/models"
)

// Connect เปิดการเชื่อมต่อ PostgreSQL
// gorm.Open จะ ping DB ให้ด้วย ถ้า DB ยังไม่เปิดจะได้ error ตรงนี้เลย
// TranslateError: true → error จาก Postgres ถูกแปลงเป็น error ของ GORM เช่น อีเมลซ้ำ = gorm.ErrDuplicatedKey
func Connect(url string) (*gorm.DB, error) {
	return gorm.Open(postgres.Open(url), &gorm.Config{TranslateError: true})
}

// Migrate สร้าง/อัปเดตตารางตาม struct ใน models (เรียงตาม foreign key: ตารางที่ถูกอ้างถึงต้องมาก่อน)
func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.User{},
		&models.Restaurant{},
		&models.RestaurantImage{},
		&models.Booking{},
		&models.Review{},
	)
}

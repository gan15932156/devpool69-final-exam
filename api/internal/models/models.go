package models

import "time"

type User struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Name         string    `gorm:"not null" json:"name"`
	Email        string    `gorm:"not null;uniqueIndex" json:"email"`
	PasswordHash string    `gorm:"not null" json:"-"`           // json:"-" = ไม่มีวันถูกส่งออกไปใน response
	TokenVersion int       `gorm:"not null;default:0" json:"-"` // ฝังใน token · logout → +1 → token เก่าทุกตัวใช้ไม่ได้
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"-"`
}

// AppSecret = ค่าลับที่ระบบสุ่มเองครั้งแรกแล้วเก็บไว้ เช่น กุญแจเซ็น JWT ตอนไม่ได้ตั้ง JWT_SECRET
// seed.Reset ไม่ลบตารางนี้ → ล้างข้อมูลตัวอย่างแล้ว login เดิมยังใช้ได้
type AppSecret struct {
	Name  string `gorm:"primaryKey"`
	Value string `gorm:"not null"`
}

// Restaurant · เวลาเปิด/ปิดเก็บเป็น int "นาทีนับจากเที่ยงคืน" ไม่ใช้ชนิด time ของ Postgres
// → บวก/ลบ/เทียบเป็นตัวเลขได้ตรง ๆ และเขียน check ช่วง 0–1439 ได้ง่าย
// ไม่มีคอลัมน์ค่าเฉลี่ยรีวิว — คำนวณสดจากตาราง reviews ทุกครั้ง (restaurantQuery) จึงไม่มีทางเพี้ยนจากรีวิวจริง
// check:... ทุกตัวในไฟล์นี้ = ด่านสุดท้ายที่ DB · ถ้าโค้ดตรวจพลาด ข้อมูลผิดก็ยังเข้าตารางไม่ได้
type Restaurant struct {
	ID                uint              `gorm:"primaryKey"`
	OwnerID           uint              `gorm:"not null;index"`
	Owner             User              `gorm:"constraint:OnDelete:CASCADE"`
	Name              string            `gorm:"not null"`
	Cuisine           string            `gorm:"not null;default:''"`
	Description       string            `gorm:"not null;default:''"`
	Seats             int               `gorm:"not null;check:seats > 0"`
	OpenMinute        int               `gorm:"not null;check:open_minute BETWEEN 0 AND 1439"`  // นาทีนับจากเที่ยงคืน 11:00 = 660
	CloseMinute       int               `gorm:"not null;check:close_minute BETWEEN 0 AND 1439"` // close <= open = ปิดข้ามเที่ยงคืน
	CancelLeadMinutes int               `gorm:"not null;default:30;check:cancel_lead_minutes >= 30"`
	Images            []RestaurantImage `gorm:"constraint:OnDelete:CASCADE"`
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// RestaurantImage แยกเป็นตาราง ไม่ใช้คอลัมน์ array → GORM สร้าง/ลบตามร้านได้ตรง ๆ
// และ CleanUploads ดึง URL ที่ยังใช้อยู่ทั้งหมดได้ใน query เดียว
type RestaurantImage struct {
	ID           uint   `gorm:"primaryKey"`
	RestaurantID uint   `gorm:"not null;index"`
	URL          string `gorm:"not null"`
	Position     int    `gorm:"not null;default:0"` // ลำดับรูป · 0 = รูปหลัก
}

// ยกเลิก = เปลี่ยน status ไม่ลบแถว → ลูกค้ายังเห็นในแท็บ "ยกเลิกแล้ว" และเจ้าของร้านเห็นในตาราง
// ใช้ข้อความ + check แทน bool → อ่านใน DB รู้เรื่อง และเพิ่มสถานะใหม่ได้โดยไม่เปลี่ยนชนิดคอลัมน์
const (
	StatusConfirmed = "confirmed"
	StatusCancelled = "cancelled"
)

// Booking เก็บเวลาจริง (timestamptz) ไม่ใช่ "วันที่ + นาที" → การจองข้ามเที่ยงคืนก็ยังเป็นช่วงต่อเนื่องช่วงเดียว
// หาการจองที่ซ้อนกันได้ด้วยเงื่อนไขเดียว start_at < จบ AND end_at > เริ่ม (ดู booking.overlapping)
type Booking struct {
	ID           uint       `gorm:"primaryKey"`
	RestaurantID uint       `gorm:"not null;index"`
	Restaurant   Restaurant `gorm:"constraint:OnDelete:CASCADE"`
	UserID       uint       `gorm:"not null;index"`
	User         User       `gorm:"constraint:OnDelete:CASCADE"`
	PartySize    int        `gorm:"not null;check:party_size > 0"`
	ServiceDate  time.Time  `gorm:"type:date;not null;index"` // "รอบ" ของวันไหน (ใช้แสดงผล/กรองเท่านั้น)
	StartAt      time.Time  `gorm:"type:timestamptz;not null"`
	EndAt        time.Time  `gorm:"type:timestamptz;not null;check:end_at > start_at"`
	Status       string     `gorm:"type:varchar(16);not null;default:confirmed;check:status IN ('confirmed','cancelled')"`
	CancelledAt  *time.Time // pointer = เป็น NULL ได้ (ยังไม่ถูกยกเลิก)
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// Review · unique คู่ (restaurant_id, user_id) = 1 คน 1 รีวิวต่อร้าน บังคับที่ DB
// และเป็นเป้าของ ON CONFLICT ใน UpsertMyReview (ส่งซ้ำ = แก้รีวิวเดิม)
type Review struct {
	ID           uint       `gorm:"primaryKey"`
	RestaurantID uint       `gorm:"not null;uniqueIndex:idx_reviews_restaurant_user"`
	Restaurant   Restaurant `gorm:"constraint:OnDelete:CASCADE"`
	UserID       uint       `gorm:"not null;uniqueIndex:idx_reviews_restaurant_user"`
	User         User       `gorm:"constraint:OnDelete:CASCADE"`
	Rating       int        `gorm:"not null;check:rating BETWEEN 1 AND 5"`
	Comment      string     `gorm:"not null;default:''"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

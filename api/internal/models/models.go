package models

import "time"

type User struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Name         string    `gorm:"not null" json:"name"`
	Email        string    `gorm:"not null;uniqueIndex" json:"email"`
	PasswordHash string    `gorm:"not null" json:"-"` // json:"-" = ไม่มีวันถูกส่งออกไปใน response
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"-"`
}

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

type RestaurantImage struct {
	ID           uint   `gorm:"primaryKey"`
	RestaurantID uint   `gorm:"not null;index"`
	URL          string `gorm:"not null"`
	Position     int    `gorm:"not null;default:0"`
}

const (
	StatusConfirmed = "confirmed"
	StatusCancelled = "cancelled"
)

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
	CancelledAt  *time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

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

package booking

import (
	"errors"
	"net/http"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"toawang/internal/apperr"
	"toawang/internal/models"
)

// slotLength ช่องละ 30 นาที = ความละเอียดเดียวกับเวลาที่ให้จอง (:00/:30)
// → ทุกการจองเริ่ม/จบตรงขอบช่องพอดี นับทีละช่องแล้วไม่มีเศษ
const slotLength = 30 * time.Minute

// 409 Conflict = ข้อมูลที่ส่งมาถูกรูปแบบ แต่ชนกับสถานะตอนนี้ (ที่นั่งเต็ม/เลยเวลา/ยกเลิกไปแล้ว)
// ต่างจาก 400 ใน validate.go ที่ข้อมูลผิดเอง
var (
	ErrSeatsExceeded     = apperr.New(http.StatusConflict, "SEATS_EXCEEDED", "ที่นั่งไม่พอ")
	ErrWindowPassed      = apperr.New(http.StatusConflict, "CANCEL_WINDOW_PASSED", "เลยเวลาที่ร้านให้แก้ไขหรือยกเลิกแล้ว")
	ErrBookingCancelled  = apperr.New(http.StatusConflict, "BOOKING_CANCELLED", "การจองนี้ถูกยกเลิกไปแล้ว")
	errRestaurantMissing = apperr.NotFound("ร้าน")
	errBookingMissing    = apperr.NotFound("การจอง")
)

// SeatsExceededDetails บอกช่วงแรกที่เกิน → หน้าเว็บเขียนข้อความเอง (seatsExceededText ใน web/lib/booking.ts)
type SeatsExceededDetails struct {
	SlotStart string `json:"slotStart"`
	SlotEnd   string `json:"slotEnd"`
	Used      int    `json:"used"`
	Party     int    `json:"party"`
	Seats     int    `json:"seats"`
}

// CancelDeadline = เวลาเริ่ม − เวลายกเลิกล่วงหน้าของร้าน · เลยจากนี้แก้ไข/ยกเลิกไม่ได้
func CancelDeadline(b *models.Booking, r *models.Restaurant) time.Time {
	return b.StartAt.Add(-time.Duration(r.CancelLeadMinutes) * time.Minute)
}

// LockRestaurant = SELECT ... FROM restaurants WHERE id = ? FOR UPDATE
// ทุกคำสั่งที่จะเปลี่ยนการจองของร้านเดียวกัน (จอง/แก้/ยกเลิก และลบร้าน) ต้องล็อกแถวร้านก่อน
// → ธุรกรรมที่มาทีหลังต้องรอคนแรกจบ จึงไม่มีทางที่สองคนเห็น "ที่ว่าง" ชุดเดียวกันแล้วจองทับกัน
//
// ทำไมล็อกแถวร้าน: ช่องที่ยังว่างไม่มีแถวการจองให้ล็อก · แถวร้านคือจุดเดียวที่ทุกการจองของร้านนั้นต้องผ่าน
// ทำไมไม่ใช้ SERIALIZABLE: Postgres จะยกเลิก transaction ที่ชนกันแล้วเราต้องเขียน retry เอง · ล็อกแถวแค่ให้รอคิว
// ราคาที่จ่าย: คำขอที่เปลี่ยนการจองของร้านเดียวกันต้องต่อคิวทีละคำขอ (คนละร้านไม่ต้องรอกัน)
func LockRestaurant(tx *gorm.DB, id uint) (*models.Restaurant, error) {
	var r models.Restaurant
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&r, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, errRestaurantMissing
	}
	return &r, err
}

// overlapping ดึงการจองที่ยืนยันแล้วและ "ซ้อน" กับช่วง from–to (ยกเว้น excludeID)
// ซ้อนกัน = เริ่มก่อนอีกอันจบ และจบหลังอีกอันเริ่ม
func overlapping(tx *gorm.DB, restaurantID uint, from, to time.Time, excludeID uint) ([]models.Booking, error) {
	q := tx.Where("restaurant_id = ? AND status = ? AND start_at < ? AND end_at > ?",
		restaurantID, models.StatusConfirmed, to, from)
	if excludeID != 0 {
		q = q.Where("id <> ?", excludeID) // แก้ไขการจอง: ไม่นับที่นั่งเดิมของตัวเองซ้ำ
	}
	var bookings []models.Booking
	err := q.Find(&bookings).Error
	return bookings, err
}

// usedIn ผลรวมจำนวนคนของการจองที่คร่อมช่วง from–to
func usedIn(bookings []models.Booking, from, to time.Time) int {
	used := 0
	for _, b := range bookings {
		if b.StartAt.Before(to) && b.EndAt.After(from) {
			used += b.PartySize
		}
	}
	return used
}

// CheckSeats วนทีละช่อง 30 นาทีตลอดช่วงที่ขอ · ทุกช่องต้อง จองแล้ว + คนที่ขอ ≤ ที่นั่ง
// ทำไมต้องดูทีละช่อง: การจอง 12:00–12:30 (7 คน) กับ 12:30–13:00 (7 คน) ไม่ได้ซ้อนกันเอง
// ถ้ารวมทั้งช่วง 12:00–13:00 จะได้ 14 ซึ่งเกินจริง · ต้องดูว่า "ณ เวลาใดเวลาหนึ่ง" มีคนนั่งพร้อมกันกี่คน
func CheckSeats(tx *gorm.DB, r *models.Restaurant, slot Slot, party int, excludeID uint) error {
	bookings, err := overlapping(tx, r.ID, slot.StartAt, slot.EndAt, excludeID)
	if err != nil {
		return err
	}
	// วนตามช่วงที่ลูกค้าขอ ขยับทีละ 30 นาที
	for t := slot.StartAt; t.Before(slot.EndAt); t = t.Add(slotLength) {
		used := usedIn(bookings, t, t.Add(slotLength))
		if party > r.Seats-used { // = used+party > Seats แต่ไม่บวก party ที่ลูกค้าส่งมา (เลขใหญ่มาก บวกแล้วล้น int กลายเป็นติดลบ → ผ่าน)
			return ErrSeatsExceeded.WithDetails(SeatsExceededDetails{
				SlotStart: Clock(t),
				SlotEnd:   Clock(t.Add(slotLength)),
				Used:      used,
				Party:     party,
				Seats:     r.Seats,
			})
		}
	}
	return nil
}

// Create จองใหม่ · ทุกคำสั่งใน Transaction ต้องใช้ tx (ถ้าเผลอใช้ db ข้างนอก query จะหลุดจาก transaction และ lock ไม่มีผล)
func Create(db *gorm.DB, restaurantID, userID uint, in Input, now time.Time) (*models.Booking, error) {
	var b models.Booking
	err := db.Transaction(func(tx *gorm.DB) error {
		r, err := LockRestaurant(tx, restaurantID)
		if err != nil {
			return err
		}
		slot, err := Validate(r, in, now)
		if err != nil {
			return err
		}
		if err := CheckSeats(tx, r, slot, in.PartySize, 0); err != nil {
			return err
		}
		b = models.Booking{
			RestaurantID: r.ID,
			UserID:       userID,
			PartySize:    in.PartySize,
			ServiceDate:  slot.ServiceDate,
			StartAt:      slot.StartAt,
			EndAt:        slot.EndAt,
			Status:       models.StatusConfirmed,
		}
		return tx.Create(&b).Error
	})
	if err != nil {
		return nil, err
	}
	return &b, nil
}

// CanModify แก้ไข/ยกเลิกได้ไหม: ต้องยังไม่ถูกยกเลิก และ ตอนนี้ ≤ เวลาเริ่ม − เวลายกเลิกล่วงหน้า
// ใช้ทั้งตอนตัดสินจริง (Update/Cancel) และตอนบอกหน้าเว็บ (canCancel) → สองที่นี้ไม่มีทางขัดกัน
func CanModify(b *models.Booking, r *models.Restaurant, now time.Time) error {
	if b.Status == models.StatusCancelled {
		return ErrBookingCancelled
	}
	if now.After(CancelDeadline(b, r)) {
		return ErrWindowPassed
	}
	return nil
}

// loadOwnBooking ใช้ใน Update/Cancel: โหลดการจอง → เช็กเจ้าของ → ล็อกร้าน → อ่านการจองใหม่หลังได้ lock → CanModify
func loadOwnBooking(tx *gorm.DB, bookingID, userID uint, now time.Time) (*models.Booking, *models.Restaurant, error) {
	var b models.Booking
	if err := tx.First(&b, bookingID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, errBookingMissing
		}
		return nil, nil, err
	}
	if b.UserID != userID {
		return nil, nil, apperr.Forbidden()
	}
	r, err := LockRestaurant(tx, b.RestaurantID)
	if err != nil {
		return nil, nil, err
	}
	// อ่านซ้ำหลังได้ lock เผื่อมีคนยกเลิก/แก้ไปก่อนหน้าเสี้ยววินาที
	if err := tx.First(&b, bookingID).Error; err != nil {
		return nil, nil, err
	}
	if err := CanModify(&b, r, now); err != nil {
		return nil, nil, err
	}
	return &b, r, nil
}

// Update แก้ไขการจอง = ตรวจกติกาเดียวกับจองใหม่ แต่ excludeID = การจองนี้ (ไม่นับที่นั่งเดิมซ้ำ)
// ตัวอย่าง: ร้าน 10 ที่ · A จอง 7 · B จอง 3 → A แก้เป็น 8: 3 + 8 = 11 ✕ · A แก้เป็น 5: 3 + 5 = 8 ✓
func Update(db *gorm.DB, bookingID, userID uint, in Input, now time.Time) error {
	return db.Transaction(func(tx *gorm.DB) error {
		b, r, err := loadOwnBooking(tx, bookingID, userID, now)
		if err != nil {
			return err
		}
		slot, err := Validate(r, in, now)
		if err != nil {
			return err
		}
		if err := CheckSeats(tx, r, slot, in.PartySize, b.ID); err != nil {
			return err
		}
		return tx.Model(b).Updates(map[string]any{
			"party_size":   in.PartySize,
			"service_date": slot.ServiceDate,
			"start_at":     slot.StartAt,
			"end_at":       slot.EndAt,
		}).Error
	})
}

// Cancel ยกเลิกได้เมื่อ ตอนนี้ ≤ เวลาเริ่ม − เวลายกเลิกล่วงหน้า (เช็กใน loadOwnBooking)
func Cancel(db *gorm.DB, bookingID, userID uint, now time.Time) error {
	return db.Transaction(func(tx *gorm.DB) error {
		b, _, err := loadOwnBooking(tx, bookingID, userID, now)
		if err != nil {
			return err
		}
		return tx.Model(b).Updates(map[string]any{
			"status":       models.StatusCancelled,
			"cancelled_at": now,
		}).Error
	})
}

// SlotUsage = ช่อง 30 นาทีหนึ่งช่องในกราฟที่นั่ง
type SlotUsage struct {
	Start string `json:"start"` // "18:00"
	Used  int    `json:"used"`  // จองแล้วกี่ที่
	Past  bool   `json:"past"`  // ช่องนี้ผ่านไปแล้ว
}

// Availability ที่นั่งที่ถูกจองในแต่ละช่อง 30 นาทีตลอดเวลาเปิดของรอบวันที่ date
// ใช้ overlapping + usedIn ตัวเดียวกับ CheckSeats → ตัวเลขในกราฟตรงกับที่ Go ใช้ตัดสินเสมอ
// อ่านเพื่อแสดงผลเฉย ๆ จึงไม่ล็อก → ตัวเลขอาจช้าไปเสี้ยววินาที แต่ตอนกดจองจริง CheckSeats ตรวจซ้ำใน transaction
func Availability(db *gorm.DB, r *models.Restaurant, date time.Time, excludeID uint, now time.Time) ([]SlotUsage, error) {
	from, to := ServiceWindow(date, r.OpenMinute, r.CloseMinute)
	bookings, err := overlapping(db, r.ID, from, to, excludeID)
	if err != nil {
		return nil, err
	}
	var slots []SlotUsage
	for t := from; t.Before(to); t = t.Add(slotLength) {
		slots = append(slots, SlotUsage{
			Start: Clock(t),
			Used:  usedIn(bookings, t, t.Add(slotLength)),
			Past:  !t.Add(slotLength).After(now),
		})
	}
	return slots, nil
}

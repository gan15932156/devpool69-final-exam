package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v3"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"toawang/internal/apperr"
	"toawang/internal/booking"
	"toawang/internal/middleware"
	"toawang/internal/models"
)

// bookingDTO — ส่งเวลาเป็นสตริงเวลาไทยไปด้วย หน้าเว็บจะได้ไม่ต้องจัดการ timezone เอง
type bookingDTO struct {
	ID                 uint   `json:"id"`
	RestaurantID       uint   `json:"restaurantId"`
	RestaurantName     string `json:"restaurantName"`
	PartySize          int    `json:"partySize"`
	ServiceDate        string `json:"serviceDate"` // "2026-09-25" รอบของวันไหน
	Start              string `json:"start"`       // "18:00"
	End                string `json:"end"`         // "01:30"
	Status             string `json:"status"`
	CancelDeadline     string `json:"cancelDeadline"`     // "17:30"
	CancelDeadlineDate string `json:"cancelDeadlineDate"` // "2026-09-25"
	CancelLeadMinutes  int    `json:"cancelLeadMinutes"`  // ร้านให้ยกเลิกล่วงหน้ากี่นาที
	CanCancel          bool   `json:"canCancel"`          // ยังแก้ไข/ยกเลิกได้ไหม (กติกาเดียวกับที่ Update/Cancel ใช้)
	HasReviewed        bool   `json:"hasReviewed"`        // เคยรีวิวร้านนี้แล้วหรือยัง
}

func toBookingDTO(b *models.Booking, r *models.Restaurant, now time.Time) bookingDTO {
	deadline := booking.CancelDeadline(b, r)
	return bookingDTO{
		ID:                 b.ID,
		RestaurantID:       r.ID,
		RestaurantName:     r.Name,
		PartySize:          b.PartySize,
		ServiceDate:        b.ServiceDate.Format(booking.DateLayout), // คอลัมน์ date เป็นเที่ยงคืน UTC จึง format ตรง ๆ
		Start:              booking.Clock(b.StartAt),
		End:                booking.Clock(b.EndAt),
		Status:             b.Status,
		CancelDeadline:     booking.Clock(deadline),
		CancelDeadlineDate: deadline.In(booking.Loc).Format(booking.DateLayout),
		CancelLeadMinutes:  r.CancelLeadMinutes,
		CanCancel:          booking.CanModify(b, r, now) == nil,
	}
}

// GET /restaurants/:id/availability?date=2026-09-25&excludeBookingId=12
// ใครก็ดูได้ · excludeBookingId ใช้ตอนแก้ไขการจอง (ไม่นับที่นั่งเดิมซ้ำ) และใช้ได้เฉพาะการจองของตัวเอง
func (h *Handler) Availability(c fiber.Ctx) error {
	id, err := paramID(c, "id")
	if err != nil {
		return err
	}
	r, err := h.findRestaurant(id)
	if err != nil {
		return err
	}
	now := h.Now()
	date := now.In(booking.Loc) // ไม่ส่ง date = รอบของวันนี้ (เวลาไทย)
	if s := c.Query("date"); s != "" {
		if date, err = booking.ParseDateParam(s); err != nil {
			return err
		}
	}

	// excludeBookingId ที่ไม่ใช่การจองของตัวเอง → เมินเฉย (นับครบทุกการจอง) แทนการตอบ error
	// endpoint นี้ใครก็เรียกได้ ถ้าตอบ 403/404 ต่างกันจะกลายเป็นช่องให้เดาว่าการจองเลขไหนมีอยู่
	var excludeID uint
	if raw := c.Query("excludeBookingId"); raw != "" {
		if n, err := strconv.ParseUint(raw, 10, 64); err == nil {
			var b models.Booking
			if h.DB.First(&b, n).Error == nil && b.UserID == middleware.UserID(c) {
				excludeID = b.ID
			}
		}
	}

	slots, err := booking.Availability(h.DB, r, date, excludeID, now)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{
		"date":  date.Format(booking.DateLayout),
		"seats": r.Seats,
		"slots": slots,
	})
}

var errBookingLimit = apperr.New(http.StatusConflict, "BOOKING_LIMIT",
	fmt.Sprintf("มีการจองที่ยังไม่ถึงเวลาครบ %d รายการแล้ว ยกเลิกรายการเดิมก่อนจองเพิ่ม", MaxActiveBookings))

// POST /restaurants/:id/bookings — กติกาการจองทั้งหมดอยู่ใน internal/booking
// ชั้นนี้เพิ่มแค่เพดานจำนวนการจองต่อคน (กันบัญชีเดียวกวาดที่นั่ง) · seed เรียก booking.Create ตรง จึงไม่โดนเพดานนี้
func (h *Handler) CreateBooking(c fiber.Ctx) error {
	// get param value
	id, err := paramID(c, "id")
	if err != nil {
		return err
	}

	// parse http body to go var
	var in booking.Input
	if err := c.Bind().Body(&in); err != nil {
		return apperr.BadBody()
	}
	now := h.Now()

	// get userId from http header
	userID := middleware.UserID(c)
	var b *models.Booking

	// query in transaction
	err = h.DB.Transaction(func(tx *gorm.DB) error {
		// ล็อกแถว user → คำขอจองของคนเดียวกันต้องต่อคิว นับแล้วค่อยจองจึงไม่หลุดเพดาน
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&models.User{}, userID).Error; err != nil {
			return err
		}
		var active int64
		if err := tx.Model(&models.Booking{}).Scopes(booking.UpcomingScope(now)).
			Where("user_id = ?", userID).Count(&active).Error; err != nil {
			return err
		}
		if active >= MaxActiveBookings {
			return errBookingLimit.WithDetails(fiber.Map{"limit": MaxActiveBookings})
		}
		var err error
		b, err = booking.Create(tx, id, userID, in, now) // transaction ซ้อน = SAVEPOINT ใน transaction นี้
		return err
	})
	if err != nil {
		return err
	}
	return h.bookingResponse(c.Status(http.StatusCreated), b.ID, now)
}

package handlers

import (
	"slices"
	"time"

	"github.com/gofiber/fiber/v3"

	"toawang/internal/apperr"
	"toawang/internal/booking"
	"toawang/internal/middleware"
	"toawang/internal/models"
)

type myBookingsResponse struct {
	Upcoming  []bookingDTO `json:"upcoming"`  // ยืนยันแล้ว และยังไม่จบ (เรียงใกล้ → ไกล)
	Past      []bookingDTO `json:"past"`      // ยืนยันแล้ว และจบไปแล้ว (ล่าสุดก่อน)
	Cancelled []bookingDTO `json:"cancelled"` // ยกเลิกแล้ว (ล่าสุดก่อน)
}

// GET /me/bookings — การจองของคนที่ login เท่านั้น
func (h *Handler) MyBookings(c fiber.Ctx) error {
	userID := middleware.UserID(c)
	now := h.Now()

	var bookings []models.Booking
	if err := h.DB.Preload("Restaurant").Where("user_id = ?", userID).
		Order("start_at").Find(&bookings).Error; err != nil {
		return err
	}

	// ร้านที่ผู้ใช้เคยรีวิวแล้ว (ดึงครั้งเดียว ไม่ query ทีละการจอง)
	var reviewedIDs []uint
	if err := h.DB.Model(&models.Review{}).Where("user_id = ?", userID).
		Pluck("restaurant_id", &reviewedIDs).Error; err != nil {
		return err
	}
	reviewed := map[uint]bool{}
	for _, id := range reviewedIDs {
		reviewed[id] = true
	}

	// แบ่งกลุ่มที่ Go ด้วยเวลาของ server → นาฬิกาเครื่องลูกค้าเพี้ยนก็ไม่ทำให้การ์ดอยู่ผิดแท็บ
	// "ผ่านมาแล้ว" ดูจากเวลาจบ ไม่ใช่เวลาเริ่ม → การจองที่กำลังนั่งกินอยู่ยังอยู่ใน "กำลังจะถึง"
	// เริ่มด้วย slice ว่างแทน nil → JSON ได้ [] ไม่ใช่ null
	res := myBookingsResponse{Upcoming: []bookingDTO{}, Past: []bookingDTO{}, Cancelled: []bookingDTO{}}
	for i := range bookings {
		b := &bookings[i]
		dto := toBookingDTO(b, &b.Restaurant, now)
		dto.HasReviewed = reviewed[b.RestaurantID]
		switch {
		case b.Status == models.StatusCancelled:
			res.Cancelled = append(res.Cancelled, dto)
		case b.EndAt.After(now):
			res.Upcoming = append(res.Upcoming, dto)
		default:
			res.Past = append(res.Past, dto)
		}
	}
	// ดึงมาเรียงเวลาเก่า → ใหม่ · ที่ผ่านมา/ยกเลิกแล้ว ต้องการล่าสุดก่อน
	slices.Reverse(res.Past)
	slices.Reverse(res.Cancelled)
	return c.JSON(res)
}

// PUT /bookings/:id — แก้ไข = กติกาเดียวกับจองใหม่ แต่ไม่นับที่นั่งเดิมของการจองนี้ซ้ำ
func (h *Handler) UpdateBooking(c fiber.Ctx) error {
	id, err := paramID(c, "id")
	if err != nil {
		return err
	}
	var in booking.Input
	if err := c.Bind().Body(&in); err != nil {
		return apperr.BadBody()
	}
	now := h.Now()
	if err := booking.Update(h.DB, id, middleware.UserID(c), in, now); err != nil {
		return err
	}
	return h.bookingResponse(c, id, now)
}

// POST /bookings/:id/cancel
func (h *Handler) CancelBooking(c fiber.Ctx) error {
	id, err := paramID(c, "id")
	if err != nil {
		return err
	}
	now := h.Now()
	if err := booking.Cancel(h.DB, id, middleware.UserID(c), now); err != nil {
		return err
	}
	return h.bookingResponse(c, id, now)
}

// bookingResponse อ่านการจองล่าสุดจาก DB (พร้อมร้าน) แล้วตอบเป็น bookingDTO
func (h *Handler) bookingResponse(c fiber.Ctx, id uint, now time.Time) error {
	var fresh models.Booking
	if err := h.DB.Preload("Restaurant").First(&fresh, id).Error; err != nil {
		return err
	}
	return c.JSON(toBookingDTO(&fresh, &fresh.Restaurant, now))
}

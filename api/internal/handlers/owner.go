package handlers

import (
	"github.com/gofiber/fiber/v3"

	"toawang/internal/booking"
	"toawang/internal/models"
)

type ownerBookingDTO struct {
	ID           uint   `json:"id"`
	CustomerName string `json:"customerName"`
	PartySize    int    `json:"partySize"`
	Start        string `json:"start"`
	End          string `json:"end"`
	Status       string `json:"status"`
}

// GET /restaurants/:id/bookings?date=2026-09-25 — รายการจองของรอบวันนั้น (เจ้าของร้านเท่านั้น)
// กรองด้วย service_date → ร้านโต้รุ่ง การจอง 01:00 ของคืนวันที่ 25 อยู่ในรายการวันที่ 25
func (h *Handler) RestaurantBookings(c fiber.Ctx) error {
	r, err := h.ownedRestaurant(c)
	if err != nil {
		return err
	}
	date, err := booking.ParseDateParam(c.Query("date"))
	if err != nil {
		return err
	}

	var rows []models.Booking
	if err := h.DB.Preload("User").
		Where("restaurant_id = ? AND service_date = ?", r.ID, date.Format(booking.DateLayout)).
		Order("start_at, id").Find(&rows).Error; err != nil {
		return err
	}
	out := make([]ownerBookingDTO, len(rows))
	for i, b := range rows {
		out[i] = ownerBookingDTO{
			ID:           b.ID,
			CustomerName: b.User.Name,
			PartySize:    b.PartySize,
			Start:        booking.Clock(b.StartAt),
			End:          booking.Clock(b.EndAt),
			Status:       b.Status,
		}
	}
	return c.JSON(out)
}

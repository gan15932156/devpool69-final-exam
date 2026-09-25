package handlers

import (
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/static"

	"toawang/internal/middleware"
)

// Routes ผูก URL เข้ากับ handler ทั้งหมด
func (h *Handler) Routes(app *fiber.App) {
	auth := middleware.RequireAuth(h.JWTSecret)

	api := app.Group("/api/v1")
	api.Get("/health", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	// บัญชี
	api.Post("/auth/register", h.Register)
	api.Post("/auth/login", h.Login)
	api.Get("/me", auth, h.Me)

	// ร้าน
	api.Get("/restaurants", h.ListRestaurants)
	api.Get("/restaurants/:id", h.GetRestaurant)
	api.Post("/restaurants", auth, h.CreateRestaurant)
	api.Put("/restaurants/:id", auth, h.UpdateRestaurant)
	api.Delete("/restaurants/:id", auth, h.DeleteRestaurant)
	api.Get("/me/restaurants", auth, h.MyRestaurants)
	api.Post("/uploads", auth, h.Upload)

	// การจอง
	optionalAuth := middleware.OptionalAuth(h.JWTSecret)
	api.Get("/restaurants/:id/availability", optionalAuth, h.Availability)
	api.Post("/restaurants/:id/bookings", auth, h.CreateBooking)

	// การจองของฉัน
	api.Get("/me/bookings", auth, h.MyBookings)
	api.Put("/bookings/:id", auth, h.UpdateBooking)
	api.Post("/bookings/:id/cancel", auth, h.CancelBooking)

	// รีวิว
	api.Get("/restaurants/:id/reviews", optionalAuth, h.ListReviews)
	api.Put("/restaurants/:id/reviews/me", auth, h.UpsertMyReview)

	// Dashboard เจ้าของร้าน
	api.Get("/restaurants/:id/bookings", auth, h.RestaurantBookings)

	// ไฟล์รูปที่อัปโหลด: GET /uploads/<ชื่อไฟล์>
	app.Use("/uploads", static.New(h.UploadDir))
}

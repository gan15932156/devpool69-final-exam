package handlers

import (
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/static"

	"toawang/internal/apidocs"
	"toawang/internal/middleware"
)

// Routes ผูก URL เข้ากับ handler ทั้งหมด
func (h *Handler) Routes(app *fiber.App) {
	auth := middleware.RequireAuth(h.JWTSecret, h.DB)
	optionalAuth := middleware.OptionalAuth(h.JWTSecret, h.DB)
	limit := newLimits() // rate limit · ค่าอยู่ใน limits.go

	api := app.Group("/api/v1")
	api.Get("/health", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	// บัญชี
	api.Post("/auth/register", limit.register, limit.registerAll, h.Register)
	api.Post("/auth/login", limit.login, h.Login)
	api.Post("/auth/logout", auth, h.Logout)
	api.Get("/me", auth, h.Me)

	// ร้าน
	api.Get("/restaurants", h.ListRestaurants)
	api.Get("/restaurants/:id", h.GetRestaurant)
	api.Post("/restaurants", auth, limit.write, h.CreateRestaurant)
	api.Put("/restaurants/:id", auth, limit.write, h.UpdateRestaurant)
	api.Delete("/restaurants/:id", auth, limit.write, h.DeleteRestaurant)
	api.Get("/me/restaurants", auth, h.MyRestaurants)
	api.Post("/uploads", auth, limit.upload, h.Upload)

	// การจอง
	api.Get("/restaurants/:id/availability", optionalAuth, h.Availability)
	api.Post("/restaurants/:id/bookings", auth, limit.write, h.CreateBooking)

	// การจองของฉัน
	api.Get("/me/bookings", auth, h.MyBookings)
	api.Put("/bookings/:id", auth, limit.write, h.UpdateBooking)
	api.Post("/bookings/:id/cancel", auth, limit.write, h.CancelBooking)

	// รีวิว
	api.Get("/restaurants/:id/reviews", optionalAuth, h.ListReviews)
	api.Put("/restaurants/:id/reviews/me", auth, limit.write, h.UpsertMyReview)

	// Dashboard เจ้าของร้าน
	api.Get("/restaurants/:id/bookings", auth, h.RestaurantBookings)

	// ไฟล์รูปที่อัปโหลด: GET /uploads/<ชื่อไฟล์>
	app.Use("/uploads", static.New(h.UploadDir))

	// Swagger UI: GET /docs
	apidocs.Routes(app)
}

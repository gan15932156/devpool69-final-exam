package handlers

import (
	"errors"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v3"
	"gorm.io/gorm"

	"toawang/internal/apperr"
	"toawang/internal/middleware"
	"toawang/internal/models"
)

// Handler รวมของที่ทุก endpoint ต้องใช้ · method ของมันกระจายอยู่หลายไฟล์ตามหมวด (auth.go, restaurants.go, ...)
type Handler struct {
	DB        *gorm.DB
	JWTSecret []byte
	UploadDir string
	Now       func() time.Time // แยกออกมาเผื่ออยากจำลองเวลาตอนทดสอบ
}

// paramID อ่าน :id จาก URL เป็นตัวเลข · ไม่ใช่ตัวเลข = ไม่มีของชิ้นนั้นแน่ ๆ → ตอบ 404 เหมือน id ที่ไม่มีอยู่
func paramID(c fiber.Ctx, name string) (uint, error) {
	id, err := strconv.ParseUint(c.Params(name), 10, 64)
	if err != nil || id == 0 {
		return 0, apperr.NotFound("ข้อมูล")
	}
	return uint(id), nil
}

// findRestaurant โหลดร้านตาม id · ไม่มี → 404
func (h *Handler) findRestaurant(id uint) (*models.Restaurant, error) {
	var r models.Restaurant
	if err := h.DB.First(&r, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("ร้าน")
		}
		return nil, err
	}
	return &r, nil
}

// ownedRestaurant โหลดร้านจาก :id แล้วเช็กว่าคนที่ login เป็นเจ้าของ · ไม่ใช่ → 403
// ต้องเช็กที่ API ทุกครั้ง การซ่อนปุ่มในหน้าเว็บกันคนยิง API ตรงไม่ได้
func (h *Handler) ownedRestaurant(c fiber.Ctx) (*models.Restaurant, error) {
	id, err := paramID(c, "id")
	if err != nil {
		return nil, err
	}
	r, err := h.findRestaurant(id)
	if err != nil {
		return nil, err
	}
	if r.OwnerID != middleware.UserID(c) {
		return nil, apperr.Forbidden()
	}
	return r, nil
}

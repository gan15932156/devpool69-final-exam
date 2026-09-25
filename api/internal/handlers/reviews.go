package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gofiber/fiber/v3"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"toawang/internal/apperr"
	"toawang/internal/middleware"
	"toawang/internal/models"
)

var errOwnRestaurant = apperr.New(http.StatusForbidden, "OWN_RESTAURANT", "รีวิวร้านของตัวเองไม่ได้")

type reviewDTO struct {
	ID        uint      `json:"id"`
	Rating    int       `json:"rating"`
	Comment   string    `json:"comment"`
	UserName  string    `json:"userName"`
	IsMine    bool      `json:"isMine"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func toReviewDTO(r *models.Review, me uint) reviewDTO {
	return reviewDTO{
		ID:        r.ID,
		Rating:    r.Rating,
		Comment:   r.Comment,
		UserName:  r.User.Name,
		IsMine:    me != 0 && r.UserID == me,
		CreatedAt: r.CreatedAt,
		UpdatedAt: r.UpdatedAt,
	}
}

// GET /restaurants/:id/reviews?offset=0 — ล่าสุดก่อน ทีละ 20 · login อยู่จะได้ "mine" (รีวิวของตัวเอง) มาด้วย
func (h *Handler) ListReviews(c fiber.Ctx) error {
	id, err := paramID(c, "id")
	if err != nil {
		return err
	}
	if _, err := h.findRestaurant(id); err != nil {
		return err
	}
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	if offset < 0 {
		offset = 0
	}
	const pageSize = 20
	me := middleware.UserID(c)

	var total int64
	if err := h.DB.Model(&models.Review{}).Where("restaurant_id = ?", id).Count(&total).Error; err != nil {
		return err
	}
	var rows []models.Review
	if err := h.DB.Preload("User").Where("restaurant_id = ?", id).
		Order("updated_at DESC, id DESC").Offset(offset).Limit(pageSize).Find(&rows).Error; err != nil {
		return err
	}
	items := make([]reviewDTO, len(rows))
	for i := range rows {
		items[i] = toReviewDTO(&rows[i], me)
	}

	// รีวิวของตัวเองส่งมากับหน้าแรกหน้าเดียว (หน้าเว็บอ่านจาก pages[0])
	var mine *reviewDTO
	if me != 0 && offset == 0 {
		var r models.Review
		err := h.DB.Preload("User").Where("restaurant_id = ? AND user_id = ?", id, me).First(&r).Error
		if err == nil {
			dto := toReviewDTO(&r, me)
			mine = &dto
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
	}
	return c.JSON(fiber.Map{"total": total, "items": items, "mine": mine})
}

type reviewInput struct {
	Rating  int    `json:"rating"`
	Comment string `json:"comment"`
}

// PUT /restaurants/:id/reviews/me — 1 คน 1 รีวิวต่อร้าน · ส่งซ้ำ = แก้รีวิวเดิม (upsert)
// ไม่ต้องเคยจองก่อน (ตามที่ตกลงไว้) · เจ้าของร้านรีวิวร้านตัวเองไม่ได้
func (h *Handler) UpsertMyReview(c fiber.Ctx) error {
	id, err := paramID(c, "id")
	if err != nil {
		return err
	}
	r, err := h.findRestaurant(id)
	if err != nil {
		return err
	}
	me := middleware.UserID(c)
	if r.OwnerID == me {
		return errOwnRestaurant
	}

	var in reviewInput
	if err := c.Bind().Body(&in); err != nil {
		return apperr.BadBody() // rating 3.5 ก็มาตกตรงนี้ เพราะแปลงเป็น int ไม่ได้
	}
	in.Comment = strings.TrimSpace(in.Comment)
	fields := map[string]string{}
	if in.Rating < 1 || in.Rating > 5 {
		fields["rating"] = "ให้คะแนน 1–5 ดาว"
	}
	if utf8.RuneCountInString(in.Comment) > 1000 {
		fields["comment"] = "ข้อความยาวเกิน 1,000 ตัวอักษร"
	}
	if len(fields) > 0 {
		return apperr.Validation(fields)
	}

	review := models.Review{RestaurantID: id, UserID: me, Rating: in.Rating, Comment: in.Comment}
	// INSERT ... ON CONFLICT (restaurant_id, user_id) DO UPDATE — ใช้ unique index คู่นี้เป็นตัวกันรีวิวซ้ำ
	err = h.DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "restaurant_id"}, {Name: "user_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"rating", "comment", "updated_at"}),
	}).Create(&review).Error
	if err != nil {
		return err
	}

	var saved models.Review
	if err := h.DB.Preload("User").Where("restaurant_id = ? AND user_id = ?", id, me).First(&saved).Error; err != nil {
		return err
	}
	return c.JSON(toReviewDTO(&saved, me))
}

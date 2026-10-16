package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/gofiber/fiber/v3"
	"gorm.io/gorm"

	"toawang/internal/apperr"
	"toawang/internal/booking"
	"toawang/internal/middleware"
	"toawang/internal/models"
)

// MinReviewsForRanking — ร้านที่รีวิวน้อยกว่านี้ถือว่า "รีวิวยังน้อย" (เปลี่ยนที่นี่ที่เดียว)
const MinReviewsForRanking = 5

var errHasFutureBookings = apperr.New(http.StatusConflict, "HAS_FUTURE_BOOKINGS", "ลบไม่ได้ เพราะยังมีการจองที่ยังไม่ถึงเวลา")

// ---------- ข้อมูลที่ส่งออกไปให้หน้าเว็บ ----------

type restaurantDTO struct {
	ID                uint     `json:"id"`
	OwnerID           uint     `json:"ownerId"`
	Name              string   `json:"name"`
	Cuisine           string   `json:"cuisine"`
	Description       string   `json:"description"`
	Seats             int      `json:"seats"`
	OpenTime          string   `json:"openTime"`  // "18:00"
	CloseTime         string   `json:"closeTime"` // "02:00"
	CrossesMidnight   bool     `json:"crossesMidnight"`
	CancelLeadMinutes int      `json:"cancelLeadMinutes"`
	Images            []string `json:"images"`
	AvgRating         *float64 `json:"avgRating"` // null = ยังไม่มีรีวิว
	ReviewCount       int      `json:"reviewCount"`
	HasEnoughReviews  bool     `json:"hasEnoughReviews"`
}

type restaurantDetailDTO struct {
	restaurantDTO
	Distribution map[int]int `json:"distribution"` // { 5: 104, 4: 18, ... }
}

// restaurantRow = แถวร้าน + ค่าเฉลี่ย/จำนวนรีวิวที่คำนวณสดจากตาราง reviews
type restaurantRow struct {
	models.Restaurant
	AvgRating   *float64
	ReviewCount int
}

// restaurantQuery — SELECT ร้าน พร้อมค่าเฉลี่ยรีวิว (ทศนิยม 1 ตำแหน่ง) และจำนวนรีวิว
// LEFT JOIN = ร้านที่ยังไม่มีรีวิวก็ยังออกมา (avg = NULL, count = 0)
// คำนวณสดทุกครั้ง ไม่เก็บค่าเฉลี่ยไว้ในตารางร้าน → ไม่ต้องคอยอัปเดตตอนมีรีวิวใหม่/แก้รีวิว และตัวเลขไม่มีทางเพี้ยน
// ปัดทศนิยมใน SQL → ทุกหน้าแสดงเลขเดียวกัน และเรียงตามค่าที่ผู้ใช้เห็นจริง (4.8 เท่ากัน → ตัดสินด้วยจำนวนรีวิว)
func (h *Handler) restaurantQuery() *gorm.DB {
	return h.DB.Model(&models.Restaurant{}).
		Select("restaurants.*, ROUND(AVG(reviews.rating)::numeric, 1) AS avg_rating, COUNT(reviews.id) AS review_count").
		Joins("LEFT JOIN reviews ON reviews.restaurant_id = restaurants.id").
		Group("restaurants.id")
}

// toDTOs แปลงแถวจาก DB เป็น JSON พร้อมรูป (ดึงรูปของทุกร้านใน query เดียว)
// แถวมาจาก Scan ของ SELECT ที่มีค่าคำนวณ จึงดึงรูปเองด้วย WHERE IN ครั้งเดียว ไม่ query ทีละร้าน (N+1)
func (h *Handler) toDTOs(rows []restaurantRow) ([]restaurantDTO, error) {
	ids := make([]uint, len(rows))
	for i, r := range rows {
		ids[i] = r.ID
	}
	var images []models.RestaurantImage
	if len(ids) > 0 {
		if err := h.DB.Where("restaurant_id IN ?", ids).Order("restaurant_id, position").Find(&images).Error; err != nil {
			return nil, err
		}
	}
	byRestaurant := map[uint][]string{}
	for _, img := range images {
		byRestaurant[img.RestaurantID] = append(byRestaurant[img.RestaurantID], img.URL)
	}

	out := make([]restaurantDTO, len(rows))
	for i, r := range rows {
		imgs := byRestaurant[r.ID]
		if imgs == nil { // nil → JSON เป็น null · ส่ง [] เสมอ หน้าเว็บจะได้ .map ได้เลย
			imgs = []string{}
		}
		out[i] = restaurantDTO{
			ID:                r.ID,
			OwnerID:           r.OwnerID,
			Name:              r.Name,
			Cuisine:           r.Cuisine,
			Description:       r.Description,
			Seats:             r.Seats,
			OpenTime:          booking.FormatHHMM(r.OpenMinute),
			CloseTime:         booking.FormatHHMM(r.CloseMinute),
			CrossesMidnight:   booking.CrossesMidnight(r.OpenMinute, r.CloseMinute),
			CancelLeadMinutes: r.CancelLeadMinutes,
			Images:            imgs,
			AvgRating:         r.AvgRating,
			ReviewCount:       r.ReviewCount,
			HasEnoughReviews:  r.ReviewCount >= MinReviewsForRanking,
		}
	}
	return out, nil
}

// queryDTOs รัน query ร้าน (จาก restaurantQuery) แล้วแปลงเป็น JSON
func (h *Handler) queryDTOs(q *gorm.DB) ([]restaurantDTO, error) {
	var rows []restaurantRow
	if err := q.Scan(&rows).Error; err != nil {
		return nil, err
	}
	return h.toDTOs(rows)
}

func (h *Handler) findRestaurantDetail(id uint) (*restaurantDetailDTO, error) {
	dtos, err := h.queryDTOs(h.restaurantQuery().Where("restaurants.id = ?", id))
	if err != nil {
		return nil, err
	}
	if len(dtos) == 0 {
		return nil, apperr.NotFound("ร้าน")
	}

	// การกระจายดาว: นับว่ากี่รีวิวให้ 1, 2, 3, 4, 5 ดาว
	var counts []struct {
		Rating int
		Count  int
	}
	if err := h.DB.Model(&models.Review{}).Select("rating, COUNT(*) AS count").
		Where("restaurant_id = ?", id).Group("rating").Scan(&counts).Error; err != nil {
		return nil, err
	}
	// ใส่ 0 ครบ 5 ดาวไว้ก่อน → ดาวที่ไม่มีใครให้ก็ยังมีแถวในกราฟ
	dist := map[int]int{1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
	for _, c := range counts {
		dist[c.Rating] = c.Count
	}
	return &restaurantDetailDTO{restaurantDTO: dtos[0], Distribution: dist}, nil
}

// ---------- ข้อมูลที่รับเข้ามาจากฟอร์ม ----------

type restaurantInput struct {
	Name              string   `json:"name"`
	Cuisine           string   `json:"cuisine"`
	Description       string   `json:"description"`
	Seats             int      `json:"seats"`
	OpenTime          string   `json:"openTime"`
	CloseTime         string   `json:"closeTime"`
	CancelLeadMinutes int      `json:"cancelLeadMinutes"`
	Images            []string `json:"images"`
}

// validate ตรวจฟอร์มร้าน · คืนเวลาเปิด/ปิดเป็นนาที · ผิด → 400 พร้อมบอกว่าช่องไหนผิด
func (in *restaurantInput) validate() (open, close int, err error) {
	in.Name = strings.TrimSpace(in.Name)
	in.Cuisine = strings.TrimSpace(in.Cuisine)
	in.Description = strings.TrimSpace(in.Description)
	fields := map[string]string{}

	if in.Name == "" || utf8.RuneCountInString(in.Name) > 100 {
		fields["name"] = "กรุณากรอกชื่อร้าน (ไม่เกิน 100 ตัวอักษร)"
	}
	if utf8.RuneCountInString(in.Cuisine) > 100 {
		fields["cuisine"] = "ประเภทอาหารยาวเกินไป"
	}
	if utf8.RuneCountInString(in.Description) > 2000 {
		fields["description"] = "รายละเอียดยาวเกินไป (ไม่เกิน 2,000 ตัวอักษร)"
	}
	if in.Seats < 1 || in.Seats > MaxSeats {
		fields["seats"] = fmt.Sprintf("จำนวนที่นั่งต้องอยู่ระหว่าง 1–%d", MaxSeats)
	}

	open, openErr := booking.ParseHHMM(in.OpenTime)
	close, closeErr := booking.ParseHHMM(in.CloseTime)
	switch {
	case openErr != nil:
		fields["openTime"] = "กรุณาใส่เวลาเปิด"
	case !booking.OnHalfHour(open):
		fields["openTime"] = "เวลาต้องลงที่ :00 หรือ :30"
	}
	switch {
	case closeErr != nil:
		fields["closeTime"] = "กรุณาใส่เวลาปิด"
	case !booking.OnHalfHour(close):
		fields["closeTime"] = "เวลาต้องลงที่ :00 หรือ :30"
	case openErr == nil && open == close: // กำกวม: เปิด 24 ชม. หรือไม่เปิดเลย? → ไม่รับ
		fields["closeTime"] = "เวลาเปิดและปิดต้องไม่ตรงกัน"
	}

	if in.CancelLeadMinutes < 30 || in.CancelLeadMinutes > MaxCancelLeadMinutes {
		fields["cancelLeadMinutes"] = "ยกเลิกล่วงหน้าได้ตั้งแต่ 30 นาทีถึง 7 วัน"
	}

	if len(in.Images) == 0 || len(in.Images) > 8 {
		fields["images"] = "ต้องมีรูป 1–8 รูป"
	}
	for _, url := range in.Images {
		// รับเฉพาะรูปที่อัปโหลดผ่าน /uploads ของเราเอง
		if !strings.HasPrefix(url, "/uploads/") || strings.Contains(url, "..") {
			fields["images"] = "รูปไม่ถูกต้อง กรุณาอัปโหลดใหม่"
		}
	}

	if len(fields) > 0 {
		return 0, 0, apperr.Validation(fields)
	}
	return open, close, nil
}

func imagesOf(restaurantID uint, urls []string) []models.RestaurantImage {
	imgs := make([]models.RestaurantImage, len(urls))
	for i, url := range urls {
		imgs[i] = models.RestaurantImage{RestaurantID: restaurantID, URL: url, Position: i}
	}
	return imgs
}

// ---------- handlers ----------

// GET /restaurants?q=&sort=rating|reviews
func (h *Handler) ListRestaurants(c fiber.Ctx) error {
	query := h.restaurantQuery()
	if q := strings.TrimSpace(c.Query("q")); q != "" {
		// ILIKE '%คำ%' แทน full-text search ของ Postgres เพราะตัวนั้นตัดคำภาษาไทยไม่ได้ (ไทยไม่เว้นวรรคระหว่างคำ)
		// ต้องสแกนทั้งตารางทุกครั้ง แต่ร้านมีหลักร้อย ยังเร็วพอ
		like := "%" + q + "%"
		query = query.Where("restaurants.name ILIKE ? OR restaurants.cuisine ILIKE ?", like, like)
	}

	switch c.Query("sort", "rating") {
	case "rating":
		// ร้านที่รีวิวถึงเกณฑ์ขึ้นก่อน → แล้วค่อยเรียงคะแนน · 5.0 จาก 1 รีวิว จึงไม่แซง 4.8 จาก 126 รีวิว
		query = query.Order(fmt.Sprintf("(COUNT(reviews.id) >= %d) DESC", MinReviewsForRanking)).
			Order("avg_rating DESC NULLS LAST").
			Order("review_count DESC")
	case "reviews":
		query = query.Order("review_count DESC").Order("avg_rating DESC NULLS LAST")
	default:
		return apperr.Validation(map[string]string{"sort": "sort ต้องเป็น rating หรือ reviews"})
	}
	// ปิดท้ายด้วย id → ร้านที่ค่าเท่ากันเรียงเหมือนเดิมทุกครั้ง ไม่สลับที่ไปมาตอนรีเฟรช
	dtos, err := h.queryDTOs(query.Order("restaurants.id"))
	if err != nil {
		return err
	}
	return c.JSON(dtos)
}

// GET /restaurants/:id
func (h *Handler) GetRestaurant(c fiber.Ctx) error {
	id, err := paramID(c, "id")
	if err != nil {
		return err
	}
	dto, err := h.findRestaurantDetail(id)
	if err != nil {
		return err
	}
	return c.JSON(dto)
}

// GET /me/restaurants
func (h *Handler) MyRestaurants(c fiber.Ctx) error {
	dtos, err := h.queryDTOs(h.restaurantQuery().Where("restaurants.owner_id = ?", middleware.UserID(c)).
		Order("restaurants.id"))
	if err != nil {
		return err
	}
	return c.JSON(dtos)
}

// POST /restaurants — คนที่ login = เจ้าของร้าน
func (h *Handler) CreateRestaurant(c fiber.Ctx) error {
	var in restaurantInput
	if err := c.Bind().Body(&in); err != nil {
		return apperr.BadBody()
	}
	open, close, err := in.validate()
	if err != nil {
		return err
	}

	r := models.Restaurant{
		OwnerID:           middleware.UserID(c),
		Name:              in.Name,
		Cuisine:           in.Cuisine,
		Description:       in.Description,
		Seats:             in.Seats,
		OpenMinute:        open,
		CloseMinute:       close,
		CancelLeadMinutes: in.CancelLeadMinutes,
		Images:            imagesOf(0, in.Images), // GORM สร้างแถวรูปให้ด้วยใน transaction เดียวกัน
	}
	if err := h.DB.Create(&r).Error; err != nil {
		return err
	}

	dto, err := h.findRestaurantDetail(r.ID)
	if err != nil {
		return err
	}
	return c.Status(http.StatusCreated).JSON(dto)
}

// PUT /restaurants/:id — เจ้าของเท่านั้น
// เปลี่ยนที่นั่ง/เวลาเปิด ไม่กระทบการจองที่มีอยู่แล้ว (กติกาใหม่ใช้กับการจอง/แก้ไขครั้งถัดไป)
func (h *Handler) UpdateRestaurant(c fiber.Ctx) error {
	r, err := h.ownedRestaurant(c)
	if err != nil {
		return err
	}
	var in restaurantInput
	if err := c.Bind().Body(&in); err != nil {
		return apperr.BadBody()
	}
	open, close, err := in.validate()
	if err != nil {
		return err
	}

	err = h.DB.Transaction(func(tx *gorm.DB) error {
		// ใช้ map เพื่อให้ GORM อัปเดตค่าศูนย์/ค่าว่างด้วย (struct จะข้ามค่าศูนย์)
		if err := tx.Model(r).Updates(map[string]any{
			"name":                in.Name,
			"cuisine":             in.Cuisine,
			"description":         in.Description,
			"seats":               in.Seats,
			"open_minute":         open,
			"close_minute":        close,
			"cancel_lead_minutes": in.CancelLeadMinutes,
		}).Error; err != nil {
			return err
		}
		// รูป: ลบของเดิมทั้งหมดแล้วใส่ใหม่ตามลำดับที่ส่งมา · ง่ายกว่าไล่เทียบว่ารูปไหนเพิ่ม/ลบ/ย้ายที่ (มีไม่เกิน 8 แถว)
		// ไฟล์รูปที่เลิกใช้ไม่ลบตรงนี้ → CleanUploads เก็บกวาดทีหลัง
		if err := tx.Where("restaurant_id = ?", r.ID).Delete(&models.RestaurantImage{}).Error; err != nil {
			return err
		}
		imgs := imagesOf(r.ID, in.Images)
		return tx.Create(&imgs).Error
	})
	if err != nil {
		return err
	}

	dto, err := h.findRestaurantDetail(r.ID)
	if err != nil {
		return err
	}
	return c.JSON(dto)
}

// DELETE /restaurants/:id — เจ้าของเท่านั้น · ยังมีการจองที่ยังไม่จบ → 409
// นับแล้วลบใน transaction ที่ล็อกแถวร้านไว้ (FOR UPDATE แบบเดียวกับตอนจอง) → การจองที่เข้ามาระหว่างนับกับลบ
// ต้องรอจนลบเสร็จแล้วได้ 404 แทนที่จะได้ 201 แล้วโดนลบตามร้านไปเงียบ ๆ
func (h *Handler) DeleteRestaurant(c fiber.Ctx) error {
	r, err := h.ownedRestaurant(c)
	if err != nil {
		return err
	}

	err = h.DB.Transaction(func(tx *gorm.DB) error {
		if _, err := booking.LockRestaurant(tx, r.ID); err != nil {
			return err
		}
		var upcoming int64
		if err := tx.Model(&models.Booking{}).
			Where("restaurant_id = ? AND status = ? AND end_at > ?", r.ID, models.StatusConfirmed, h.Now()).
			Count(&upcoming).Error; err != nil {
			return err
		}
		if upcoming > 0 {
			return errHasFutureBookings.WithDetails(fiber.Map{"count": upcoming})
		}
		// รูป / การจองเก่า / รีวิว ถูกลบตามด้วย ON DELETE CASCADE ที่ DB
		return tx.Delete(&models.Restaurant{}, r.ID).Error
	})
	if err != nil {
		return err
	}
	return c.SendStatus(http.StatusNoContent)
}

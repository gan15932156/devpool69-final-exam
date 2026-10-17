package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"
	"gorm.io/gorm"

	"toawang/internal/apperr"
	"toawang/internal/booking"
	"toawang/internal/models"
	"toawang/internal/testdb"
)

// integration test: ยิง HTTP ผ่าน Routes ชุดจริง (auth + rate limit) กับ Postgres จริง · ไม่มี DB = skip
// Now = เวลาจริง เพราะ middleware ตรวจวันหมดอายุของ token ด้วยนาฬิกาจริง → วันที่จองคิดจาก "พรุ่งนี้"

type api struct {
	t   *testing.T
	app *fiber.App
	db  *gorm.DB
}

func newAPI(t *testing.T) *api {
	db := testdb.Open(t, "handlers")
	h := &Handler{
		DB:        db,
		JWTSecret: []byte("test-secret-at-least-32-characters!!"),
		UploadDir: t.TempDir(),
		Now:       time.Now,
	}
	app := fiber.New(fiber.Config{ErrorHandler: apperr.Handler})
	h.Routes(app)
	return &api{t: t, app: app, db: db}
}

// call ยิงคำขอ · body = nil ไม่ส่ง body · out = nil ไม่อ่าน response · คืน status
func (a *api) call(method, path, token string, body, out any) int {
	a.t.Helper()
	var r io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		r = bytes.NewReader(b)
	}
	req := httptest.NewRequest(method, "/api/v1"+path, r)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := a.app.Test(req, fiber.TestConfig{Timeout: 10 * time.Second})
	if err != nil {
		a.t.Fatalf("%s %s: %v", method, path, err)
	}
	defer res.Body.Close()
	if out != nil {
		raw, _ := io.ReadAll(res.Body)
		if err := json.Unmarshal(raw, out); err != nil {
			a.t.Fatalf("%s %s: decode %q: %v", method, path, raw, err)
		}
	}
	return res.StatusCode
}

// code ยิงคำขอแล้วคืน status + error code
func (a *api) code(method, path, token string, body any) (int, string) {
	a.t.Helper()
	var eb struct {
		Error struct{ Code string } `json:"error"`
	}
	status := a.call(method, path, token, body, &eb)
	return status, eb.Error.Code
}

// register สมัครแล้วคืน token
func (a *api) register(name, email string) string {
	a.t.Helper()
	var res struct{ AccessToken string }
	if s := a.call(http.MethodPost, "/auth/register", "", registerRequest{Name: name, Email: email, Password: "password1"}, &res); s != 201 {
		a.t.Fatalf("register %s: status %d", email, s)
	}
	return res.AccessToken
}

func (a *api) createRestaurant(token string, in restaurantInput) restaurantDetailDTO {
	a.t.Helper()
	var dto restaurantDetailDTO
	if s := a.call(http.MethodPost, "/restaurants", token, in, &dto); s != 201 {
		a.t.Fatalf("create restaurant: status %d", s)
	}
	return dto
}

func dayShopInput() restaurantInput {
	return restaurantInput{Name: "ร้านกลางวัน", Cuisine: "ไทย", Seats: 10, OpenTime: "11:00", CloseTime: "22:00",
		CancelLeadMinutes: 60, Images: []string{"/uploads/a.jpg", "/uploads/b.jpg"}}
}

func tomorrow() string {
	return time.Now().In(booking.Loc).AddDate(0, 0, 1).Format(booking.DateLayout)
}

// ---------- บัญชี ----------

func TestAuthFlow(t *testing.T) {
	a := newAPI(t)

	var reg map[string]any
	if s := a.call(http.MethodPost, "/auth/register", "", registerRequest{Name: " ต้น ", Email: " Ton@Example.COM ", Password: "password1"}, &reg); s != 201 {
		t.Fatalf("register: %d", s)
	}
	user := reg["user"].(map[string]any)
	if user["email"] != "ton@example.com" || user["name"] != "ต้น" {
		t.Errorf("user = %v", user)
	}
	if _, leaked := user["passwordHash"]; leaked {
		t.Error("ห้ามส่ง passwordHash ออกไป")
	}
	token := reg["accessToken"].(string)

	if s, c := a.code(http.MethodPost, "/auth/register", "", registerRequest{Name: "ซ้ำ", Email: "TON@example.com", Password: "password1"}); s != 409 || c != "EMAIL_TAKEN" {
		t.Errorf("สมัครซ้ำ (ตัวพิมพ์ต่าง): %d %s", s, c)
	}
	if s, c := a.code(http.MethodPost, "/auth/login", "", loginRequest{Email: "ton@example.com", Password: "wrong-pass1"}); s != 401 || c != "UNAUTHORIZED" {
		t.Errorf("รหัสผิด: %d %s", s, c)
	}
	if s, _ := a.code(http.MethodPost, "/auth/login", "", loginRequest{Email: "nobody@example.com", Password: "password1"}); s != 401 {
		t.Errorf("ไม่มีบัญชี: %d (ต้องตอบเหมือนรหัสผิด)", s)
	}

	var login struct{ AccessToken string }
	if s := a.call(http.MethodPost, "/auth/login", "", loginRequest{Email: " TON@example.com", Password: "password1"}, &login); s != 200 {
		t.Fatalf("login: %d", s)
	}
	var me models.User
	if s := a.call(http.MethodGet, "/me", login.AccessToken, nil, &me); s != 200 || me.Email != "ton@example.com" {
		t.Errorf("me: %d %+v", s, me)
	}

	// logout → token ทุกตัวที่ออกก่อนหน้า (ทั้งจาก register และ login) ใช้ไม่ได้ทันที
	if s := a.call(http.MethodPost, "/auth/logout", login.AccessToken, nil, nil); s != 204 {
		t.Fatalf("logout: %d", s)
	}
	for _, old := range []string{token, login.AccessToken} {
		if s, _ := a.code(http.MethodGet, "/me", old, nil); s != 401 {
			t.Errorf("token เก่าหลัง logout: %d; want 401", s)
		}
	}
	a.call(http.MethodPost, "/auth/login", "", loginRequest{Email: "ton@example.com", Password: "password1"}, &login)
	if s := a.call(http.MethodGet, "/me", login.AccessToken, nil, nil); s != 200 {
		t.Errorf("login ใหม่หลัง logout: %d", s)
	}
}

func TestDeletedUserTokenRejected(t *testing.T) {
	a := newAPI(t)
	token := a.register("ต้น", "ton@example.com")
	a.db.Exec("DELETE FROM users")
	if s, _ := a.code(http.MethodGet, "/me", token, nil); s != 401 {
		t.Errorf("user ถูกลบ: %d; want 401", s)
	}
}

func TestLoginRateLimitPerEmail(t *testing.T) {
	a := newAPI(t)
	a.register("ต้น", "ton@example.com")
	wrong := loginRequest{Email: "ton@example.com", Password: "wrong-pass1"}
	for i := range 10 {
		if s, _ := a.code(http.MethodPost, "/auth/login", "", wrong); s != 401 {
			t.Fatalf("ครั้งที่ %d: %d", i+1, s)
		}
	}
	if s, c := a.code(http.MethodPost, "/auth/login", "", wrong); s != 429 || c != "TOO_MANY_REQUESTS" {
		t.Errorf("ครั้งที่ 11: %d %s", s, c)
	}
	// เปลี่ยนตัวพิมพ์ก็ยังนับเป็นอีเมลเดียวกัน · รหัสถูกก็ยังโดนบล็อกจนหมดช่วง
	if s, _ := a.code(http.MethodPost, "/auth/login", "", loginRequest{Email: "TON@example.com", Password: "password1"}); s != 429 {
		t.Errorf("อีเมลเดิมตัวพิมพ์ต่าง: %d; want 429", s)
	}
	// อีเมลอื่นไม่โดนด้วย
	if s, _ := a.code(http.MethodPost, "/auth/login", "", loginRequest{Email: "other@example.com", Password: "x"}); s != 401 {
		t.Errorf("อีเมลอื่น: %d; want 401", s)
	}
}

func TestRequireAuthRoutes(t *testing.T) {
	a := newAPI(t)
	for _, r := range []struct{ method, path string }{
		{http.MethodGet, "/me"},
		{http.MethodPost, "/restaurants"},
		{http.MethodGet, "/me/bookings"},
		{http.MethodPost, "/restaurants/1/bookings"},
		{http.MethodPut, "/restaurants/1/reviews/me"},
		{http.MethodGet, "/restaurants/1/bookings"},
		{http.MethodPost, "/uploads"},
	} {
		if s, c := a.code(r.method, r.path, "", nil); s != 401 || c != "UNAUTHORIZED" {
			t.Errorf("%s %s: %d %s; want 401", r.method, r.path, s, c)
		}
	}
}

// ---------- ร้าน ----------

func TestRestaurantCRUD(t *testing.T) {
	a := newAPI(t)
	owner := a.register("เจ้าของ", "owner@example.com")
	other := a.register("คนอื่น", "other@example.com")

	night := dayShopInput()
	night.OpenTime, night.CloseTime = "18:00", "02:00"
	created := a.createRestaurant(owner, night)
	if created.OpenTime != "18:00" || created.CloseTime != "02:00" || !created.CrossesMidnight ||
		len(created.Images) != 2 || created.AvgRating != nil || created.ReviewCount != 0 || len(created.Distribution) != 5 {
		t.Errorf("created = %+v", created)
	}
	path := fmt.Sprintf("/restaurants/%d", created.ID)

	update := dayShopInput()
	update.Name = "ชื่อใหม่"
	update.Images = []string{"/uploads/c.jpg"}
	if s, c := a.code(http.MethodPut, path, other, update); s != 403 || c != "FORBIDDEN" {
		t.Errorf("คนอื่นแก้: %d %s", s, c)
	}
	if s, c := a.code(http.MethodDelete, path, other, nil); s != 403 || c != "FORBIDDEN" {
		t.Errorf("คนอื่นลบ: %d %s", s, c)
	}

	var updated restaurantDetailDTO
	if s := a.call(http.MethodPut, path, owner, update, &updated); s != 200 {
		t.Fatalf("แก้: %d", s)
	}
	if updated.Name != "ชื่อใหม่" || updated.CrossesMidnight || len(updated.Images) != 1 || updated.Images[0] != "/uploads/c.jpg" {
		t.Errorf("updated = %+v", updated)
	}
	var imgCount int64
	a.db.Model(&models.RestaurantImage{}).Where("restaurant_id = ?", created.ID).Count(&imgCount)
	if imgCount != 1 {
		t.Errorf("รูปเดิมต้องถูกแทนที่: เหลือ %d แถว", imgCount)
	}

	var mine []restaurantDTO
	a.call(http.MethodGet, "/me/restaurants", owner, nil, &mine)
	if len(mine) != 1 || mine[0].ID != created.ID {
		t.Errorf("ร้านของเจ้าของ = %+v", mine)
	}
	a.call(http.MethodGet, "/me/restaurants", other, nil, &mine)
	if len(mine) != 0 {
		t.Errorf("ร้านของคนอื่น = %+v", mine)
	}

	if s, c := a.code(http.MethodGet, "/restaurants/999", "", nil); s != 404 || c != "NOT_FOUND" {
		t.Errorf("ไม่มีร้าน: %d %s", s, c)
	}
	if s := a.call(http.MethodDelete, path, owner, nil, nil); s != 204 {
		t.Errorf("ลบ: %d", s)
	}
	if s, _ := a.code(http.MethodGet, path, "", nil); s != 404 {
		t.Errorf("หลังลบ: %d", s)
	}
}

func TestDeleteRestaurantBlockedByUpcomingBooking(t *testing.T) {
	a := newAPI(t)
	owner := a.register("เจ้าของ", "owner@example.com")
	customer := a.register("ลูกค้า", "c@example.com")
	shop := a.createRestaurant(owner, dayShopInput())
	path := fmt.Sprintf("/restaurants/%d", shop.ID)

	var b bookingDTO
	if s := a.call(http.MethodPost, path+"/bookings", customer, booking.Input{Date: tomorrow(), Start: "18:00", End: "19:00", PartySize: 2}, &b); s != 201 {
		t.Fatalf("จอง: %d", s)
	}
	if s, c := a.code(http.MethodDelete, path, owner, nil); s != 409 || c != "HAS_FUTURE_BOOKINGS" {
		t.Errorf("ลบร้านที่ยังมีการจอง: %d %s", s, c)
	}
	a.call(http.MethodPost, fmt.Sprintf("/bookings/%d/cancel", b.ID), customer, nil, nil)
	if s := a.call(http.MethodDelete, path, owner, nil, nil); s != 204 {
		t.Errorf("ลบหลังยกเลิก: %d", s)
	}
	var left int64
	a.db.Model(&models.Booking{}).Count(&left)
	if left != 0 {
		t.Errorf("การจองต้องถูกลบตามร้าน (CASCADE): เหลือ %d", left)
	}
}

// seedReviews สร้างร้านกับรีวิวตรง ๆ ใน DB (ไม่ผ่าน API)
func seedReviews(t *testing.T, db *gorm.DB, name, cuisine string, owner uint, ratings ...int) uint {
	t.Helper()
	r := models.Restaurant{OwnerID: owner, Name: name, Cuisine: cuisine, Seats: 10, OpenMinute: 660, CloseMinute: 1320, CancelLeadMinutes: 30}
	if err := db.Create(&r).Error; err != nil {
		t.Fatal(err)
	}
	for i, rating := range ratings {
		u := models.User{Name: "u", Email: fmt.Sprintf("%s-%d@example.com", name, i), PasswordHash: "x"}
		db.Create(&u)
		if err := db.Create(&models.Review{RestaurantID: r.ID, UserID: u.ID, Rating: rating}).Error; err != nil {
			t.Fatal(err)
		}
	}
	return r.ID
}

func TestListRestaurantsSortAndSearch(t *testing.T) {
	a := newAPI(t)
	owner := models.User{Name: "o", Email: "o@example.com", PasswordHash: "x"}
	a.db.Create(&owner)
	one := seedReviews(t, a.db, "perfect", "Somtam", owner.ID, 5)              // 5.0 จาก 1 รีวิว
	many := seedReviews(t, a.db, "popular", "noodle", owner.ID, 5, 4, 4, 4, 4) // 4.2 จาก 5 รีวิว
	none := seedReviews(t, a.db, "new", "SOMTAM isan", owner.ID)

	ids := func(path string) []uint {
		var list []restaurantDTO
		if s := a.call(http.MethodGet, path, "", nil, &list); s != 200 {
			t.Fatalf("GET %s: %d", path, s)
		}
		out := make([]uint, len(list))
		for i, r := range list {
			out[i] = r.ID
		}
		return out
	}
	eq := func(got, want []uint) bool { return fmt.Sprint(got) == fmt.Sprint(want) }

	// รีวิวถึงเกณฑ์ขึ้นก่อน → 5.0 จาก 1 รีวิวไม่แซง 4.2 จาก 5 รีวิว · ไม่มีรีวิวอยู่ท้าย
	if got := ids("/restaurants"); !eq(got, []uint{many, one, none}) {
		t.Errorf("sort=rating = %v; want %v", got, []uint{many, one, none})
	}
	if got := ids("/restaurants?sort=reviews"); !eq(got, []uint{many, one, none}) {
		t.Errorf("sort=reviews = %v", got)
	}
	if got := ids("/restaurants?q=somTAM"); !eq(got, []uint{one, none}) {
		t.Errorf("ค้นหาไม่สนตัวพิมพ์ = %v; want %v", got, []uint{one, none})
	}
	if s, c := a.code(http.MethodGet, "/restaurants?sort=price", "", nil); s != 400 || c != "VALIDATION" {
		t.Errorf("sort ผิด: %d %s", s, c)
	}

	var detail restaurantDetailDTO
	a.call(http.MethodGet, fmt.Sprintf("/restaurants/%d", many), "", nil, &detail)
	if detail.AvgRating == nil || *detail.AvgRating != 4.2 || detail.ReviewCount != 5 || !detail.HasEnoughReviews ||
		detail.Distribution[4] != 4 || detail.Distribution[5] != 1 || detail.Distribution[1] != 0 {
		t.Errorf("detail = %+v avg %v", detail, detail.AvgRating)
	}
}

// ---------- รีวิว ----------

func TestReviews(t *testing.T) {
	a := newAPI(t)
	owner := a.register("เจ้าของ", "owner@example.com")
	customer := a.register("ลูกค้า", "c@example.com")
	shop := a.createRestaurant(owner, dayShopInput())
	path := fmt.Sprintf("/restaurants/%d/reviews", shop.ID)

	if s, c := a.code(http.MethodPut, path+"/me", owner, reviewInput{Rating: 5}); s != 403 || c != "OWN_RESTAURANT" {
		t.Errorf("รีวิวร้านตัวเอง: %d %s", s, c)
	}
	if s, c := a.code(http.MethodPut, path+"/me", customer, reviewInput{Rating: 6}); s != 400 || c != "VALIDATION" {
		t.Errorf("rating 6: %d %s", s, c)
	}

	var first, second reviewDTO
	if s := a.call(http.MethodPut, path+"/me", customer, reviewInput{Rating: 3, Comment: " ok "}, &first); s != 200 {
		t.Fatalf("รีวิว: %d", s)
	}
	time.Sleep(10 * time.Millisecond)
	if s := a.call(http.MethodPut, path+"/me", customer, reviewInput{Rating: 5, Comment: "ดีมาก"}, &second); s != 200 {
		t.Fatalf("แก้รีวิว: %d", s)
	}
	// ส่งซ้ำ = แก้แถวเดิม · created_at ต้องเป็นของเดิม
	if second.ID != first.ID || second.Rating != 5 || second.Comment != "ดีมาก" || first.Comment != "ok" ||
		!second.CreatedAt.Equal(first.CreatedAt) || !second.UpdatedAt.After(first.UpdatedAt) || !second.IsMine || second.UserName != "ลูกค้า" {
		t.Errorf("first %+v second %+v", first, second)
	}

	var page struct {
		Total int64
		Items []reviewDTO
		Mine  *reviewDTO
	}
	a.call(http.MethodGet, path, customer, nil, &page)
	if page.Total != 1 || len(page.Items) != 1 || page.Mine == nil || page.Mine.ID != first.ID {
		t.Errorf("ลูกค้าดู: %+v", page)
	}
	page.Mine = nil
	a.call(http.MethodGet, path, "", nil, &page)
	if page.Mine != nil || page.Items[0].IsMine {
		t.Errorf("ไม่ได้ login ดู: %+v", page)
	}
	a.call(http.MethodGet, path+"?offset=-5", customer, nil, &page)
	if len(page.Items) != 1 {
		t.Errorf("offset ติดลบต้องถือเป็น 0: %+v", page)
	}

	var detail restaurantDetailDTO
	a.call(http.MethodGet, fmt.Sprintf("/restaurants/%d", shop.ID), "", nil, &detail)
	if detail.AvgRating == nil || *detail.AvgRating != 5 || detail.ReviewCount != 1 || detail.HasEnoughReviews {
		t.Errorf("ค่าเฉลี่ยหลังแก้รีวิว: %+v", detail)
	}
}

// ---------- การจอง ----------

func TestBookingFlow(t *testing.T) {
	a := newAPI(t)
	owner := a.register("เจ้าของ", "owner@example.com")
	customer := a.register("ลูกค้า", "c@example.com")
	other := a.register("คนอื่น", "other@example.com")
	shop := a.createRestaurant(owner, dayShopInput())
	shopPath := fmt.Sprintf("/restaurants/%d", shop.ID)
	date := tomorrow()

	var b bookingDTO
	if s := a.call(http.MethodPost, shopPath+"/bookings", customer, booking.Input{Date: date, Start: "18:00", End: "19:00", PartySize: 6}, &b); s != 201 {
		t.Fatalf("จอง: %d", s)
	}
	if b.Start != "18:00" || b.End != "19:00" || b.ServiceDate != date || b.CancelDeadline != "17:00" || !b.CanCancel || b.RestaurantName != "ร้านกลางวัน" {
		t.Errorf("booking = %+v", b)
	}
	if s, c := a.code(http.MethodPost, shopPath+"/bookings", other, booking.Input{Date: date, Start: "18:30", End: "19:30", PartySize: 5}); s != 409 || c != "SEATS_EXCEEDED" {
		t.Errorf("ที่นั่งไม่พอ: %d %s", s, c)
	}
	if s, c := a.code(http.MethodPost, "/restaurants/999/bookings", other, booking.Input{Date: date, Start: "18:30", End: "19:30", PartySize: 1}); s != 404 || c != "NOT_FOUND" {
		t.Errorf("ร้านไม่มี: %d %s", s, c)
	}

	type avail struct {
		Date  string
		Seats int
		Slots []booking.SlotUsage
	}
	used := func(token, query string) int {
		var av avail
		a.call(http.MethodGet, shopPath+"/availability?date="+date+query, token, nil, &av)
		for _, s := range av.Slots {
			if s.Start == "18:00" {
				return s.Used
			}
		}
		return -1
	}
	if got := used("", ""); got != 6 {
		t.Errorf("availability 18:00 = %d; want 6", got)
	}
	exclude := fmt.Sprintf("&excludeBookingId=%d", b.ID)
	if got := used(customer, exclude); got != 0 {
		t.Errorf("exclude การจองของตัวเอง = %d; want 0", got)
	}
	// การจองของคนอื่น / ไม่ได้ login → เมินเฉย ไม่บอกว่ามีการจองเลขนี้
	if got := used(other, exclude); got != 6 {
		t.Errorf("exclude การจองของคนอื่น = %d; want 6", got)
	}
	if got := used("", exclude); got != 6 {
		t.Errorf("exclude ตอนไม่ได้ login = %d; want 6", got)
	}
	if s, _ := a.code(http.MethodGet, shopPath+"/availability?date=bad", "", nil); s != 400 {
		t.Errorf("date ผิดรูปแบบ: %d", s)
	}

	bookingPath := fmt.Sprintf("/bookings/%d", b.ID)
	if s, c := a.code(http.MethodPut, bookingPath, other, booking.Input{Date: date, Start: "18:00", End: "19:00", PartySize: 1}); s != 403 || c != "FORBIDDEN" {
		t.Errorf("คนอื่นแก้: %d %s", s, c)
	}
	if s := a.call(http.MethodPut, bookingPath, customer, booking.Input{Date: date, Start: "19:00", End: "20:30", PartySize: 10}, &b); s != 200 {
		t.Fatalf("แก้: %d", s)
	}
	if b.Start != "19:00" || b.End != "20:30" || b.PartySize != 10 {
		t.Errorf("หลังแก้ = %+v", b)
	}

	// dashboard เจ้าของร้าน
	var rows []ownerBookingDTO
	if s := a.call(http.MethodGet, shopPath+"/bookings?date="+date, owner, nil, &rows); s != 200 || len(rows) != 1 || rows[0].CustomerName != "ลูกค้า" || rows[0].Start != "19:00" {
		t.Errorf("dashboard: %d %+v", s, rows)
	}
	if s, _ := a.code(http.MethodGet, shopPath+"/bookings?date="+date, customer, nil); s != 403 {
		t.Errorf("ลูกค้าเปิด dashboard: %d", s)
	}

	var mine myBookingsResponse
	a.call(http.MethodGet, "/me/bookings", customer, nil, &mine)
	if len(mine.Upcoming) != 1 || len(mine.Past) != 0 || len(mine.Cancelled) != 0 {
		t.Errorf("my bookings = %+v", mine)
	}

	if s := a.call(http.MethodPost, bookingPath+"/cancel", customer, nil, &b); s != 200 || b.Status != models.StatusCancelled || b.CanCancel {
		t.Errorf("ยกเลิก: %d %+v", s, b)
	}
	if s, c := a.code(http.MethodPost, bookingPath+"/cancel", customer, nil); s != 409 || c != "BOOKING_CANCELLED" {
		t.Errorf("ยกเลิกซ้ำ: %d %s", s, c)
	}
	a.call(http.MethodGet, "/me/bookings", customer, nil, &mine)
	if len(mine.Upcoming) != 0 || len(mine.Cancelled) != 1 {
		t.Errorf("หลังยกเลิก = %+v", mine)
	}
	// ที่นั่งคืนแล้ว
	if s := a.call(http.MethodPost, shopPath+"/bookings", other, booking.Input{Date: date, Start: "19:00", End: "20:00", PartySize: 10}, nil); s != 201 {
		t.Errorf("จองหลังมีคนยกเลิก: %d", s)
	}
}

func TestMyBookingsGrouping(t *testing.T) {
	a := newAPI(t)
	token := a.register("ลูกค้า", "c@example.com")
	var me models.User
	a.call(http.MethodGet, "/me", token, nil, &me)
	shop := models.Restaurant{OwnerID: me.ID, Name: "ร้าน", Seats: 10, OpenMinute: 0, CloseMinute: 1410, CancelLeadMinutes: 30}
	a.db.Create(&shop)
	a.db.Create(&models.Review{RestaurantID: shop.ID, UserID: me.ID, Rating: 4})

	now := time.Now()
	mk := func(start time.Time, status string) uint {
		b := models.Booking{RestaurantID: shop.ID, UserID: me.ID, PartySize: 1, ServiceDate: booking.DateOnly(start.In(booking.Loc)),
			StartAt: start, EndAt: start.Add(time.Hour), Status: status}
		a.db.Create(&b)
		return b.ID
	}
	oldPast := mk(now.Add(-72*time.Hour), models.StatusConfirmed)
	newPast := mk(now.Add(-48*time.Hour), models.StatusConfirmed)
	eating := mk(now.Add(-30*time.Minute), models.StatusConfirmed) // กำลังนั่งกินอยู่ = ยังไม่ผ่าน
	later := mk(now.Add(48*time.Hour), models.StatusConfirmed)
	soon := mk(now.Add(24*time.Hour), models.StatusConfirmed)
	cancelled := mk(now.Add(24*time.Hour), models.StatusCancelled)

	var res myBookingsResponse
	a.call(http.MethodGet, "/me/bookings", token, nil, &res)
	idsOf := func(list []bookingDTO) string {
		out := make([]uint, len(list))
		for i, b := range list {
			out[i] = b.ID
		}
		return fmt.Sprint(out)
	}
	if got, want := idsOf(res.Upcoming), fmt.Sprint([]uint{eating, soon, later}); got != want {
		t.Errorf("upcoming = %s; want %s (ใกล้ → ไกล)", got, want)
	}
	if got, want := idsOf(res.Past), fmt.Sprint([]uint{newPast, oldPast}); got != want {
		t.Errorf("past = %s; want %s (ล่าสุดก่อน)", got, want)
	}
	if got, want := idsOf(res.Cancelled), fmt.Sprint([]uint{cancelled}); got != want {
		t.Errorf("cancelled = %s; want %s", got, want)
	}
	if !res.Upcoming[0].HasReviewed {
		t.Error("เคยรีวิวร้านนี้แล้ว → HasReviewed = true")
	}
}

func TestBookingLimitPerUser(t *testing.T) {
	a := newAPI(t)
	owner := a.register("เจ้าของ", "owner@example.com")
	customer := a.register("ลูกค้า", "c@example.com")
	in := dayShopInput()
	in.Seats = MaxSeats
	shop := a.createRestaurant(owner, in)
	path := fmt.Sprintf("/restaurants/%d/bookings", shop.ID)
	req := booking.Input{Date: tomorrow(), Start: "12:00", End: "13:00", PartySize: 1}

	for i := range MaxActiveBookings {
		if s := a.call(http.MethodPost, path, customer, req, nil); s != 201 {
			t.Fatalf("จองครั้งที่ %d: %d", i+1, s)
		}
	}
	if s, c := a.code(http.MethodPost, path, customer, req); s != 409 || c != "BOOKING_LIMIT" {
		t.Errorf("เกินเพดาน: %d %s", s, c)
	}
	// คนอื่นยังจองได้
	if s := a.call(http.MethodPost, path, owner, req, nil); s != 201 {
		t.Errorf("คนอื่น: %d", s)
	}
}

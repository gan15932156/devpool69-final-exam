package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"

	"toawang/internal/apperr"
	"toawang/internal/booking"
	"toawang/internal/middleware"
	"toawang/internal/models"
)

// ไฟล์นี้ไม่ต่อ DB (Handler.DB = nil) → ทดสอบเฉพาะสิ่งที่ตัดสินก่อนถึง DB
// ถ้า handler เผลอแตะ DB ก่อนตรวจข้อมูล test จะ panic ทันที

var testNow = time.Date(2026, 9, 25, 10, 0, 0, 0, booking.Loc)

func newHandler(t *testing.T) *Handler {
	return &Handler{
		JWTSecret: []byte("test-secret-at-least-32-characters!!"),
		UploadDir: t.TempDir(),
		Now:       func() time.Time { return testNow },
	}
}

// newApp — routes ชุดเดียวกับของจริงที่ทดสอบได้โดยไม่มี DB (ข้าม auth middleware เพราะต้องถาม DB)
func newApp(h *Handler) *fiber.App {
	app := fiber.New(fiber.Config{ErrorHandler: apperr.Handler, BodyLimit: 10 * 1024 * 1024})
	app.Post("/auth/register", h.Register)
	app.Post("/restaurants", h.CreateRestaurant)
	app.Post("/restaurants/:id/bookings", h.CreateBooking)
	app.Put("/bookings/:id", h.UpdateBooking)
	app.Post("/bookings/:id/cancel", h.CancelBooking)
	app.Post("/uploads", h.Upload)
	return app
}

type errorBody struct {
	Error struct {
		Code    string            `json:"code"`
		Details map[string]string `json:"details"`
	} `json:"error"`
}

func send(t *testing.T, app *fiber.App, method, path, contentType string, body io.Reader) (*http.Response, errorBody) {
	t.Helper()
	req := httptest.NewRequest(method, path, body)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	res, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	var eb errorBody
	_ = json.Unmarshal(raw, &eb)
	return res, eb
}

func sendJSON(t *testing.T, app *fiber.App, method, path string, v any) (*http.Response, errorBody) {
	t.Helper()
	b, _ := json.Marshal(v)
	return send(t, app, method, path, "application/json", bytes.NewReader(b))
}

// ---------- auth ----------

func TestNormalizeEmail(t *testing.T) {
	if got := normalizeEmail("  Alice@Example.COM \n"); got != "alice@example.com" {
		t.Errorf("normalizeEmail = %q", got)
	}
}

func TestRegisterValidation(t *testing.T) {
	ok := registerRequest{Name: "ต้น", Email: "ton@example.com", Password: "password1"}
	cases := []struct {
		name  string
		edit  func(*registerRequest)
		field string
	}{
		{"ชื่อว่าง", func(r *registerRequest) { r.Name = "   " }, "name"},
		{"ชื่อยาวเกิน", func(r *registerRequest) { r.Name = strings.Repeat("ก", MaxNameLength+1) }, "name"},
		{"อีเมลผิด", func(r *registerRequest) { r.Email = "not-an-email" }, "email"},
		{"อีเมลมีชื่อนำหน้า", func(r *registerRequest) { r.Email = "Ton <ton@example.com>" }, "email"},
		{"รหัสสั้น", func(r *registerRequest) { r.Password = "abc1" }, "password"},
		{"รหัสไม่มีตัวเลข", func(r *registerRequest) { r.Password = "password" }, "password"},
		{"รหัสเกิน 72 byte", func(r *registerRequest) { r.Password = strings.Repeat("ก", 24) + "1" }, "password"},
	}
	app := newApp(newHandler(t))
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			req := ok
			c.edit(&req)
			res, body := sendJSON(t, app, http.MethodPost, "/auth/register", req)
			if res.StatusCode != 400 || body.Error.Code != "VALIDATION" || body.Error.Details[c.field] == "" {
				t.Errorf("status %d body %+v; want 400 VALIDATION ที่ช่อง %s", res.StatusCode, body, c.field)
			}
		})
	}

	t.Run("JSON เสีย", func(t *testing.T) {
		res, body := send(t, app, http.MethodPost, "/auth/register", "application/json", strings.NewReader("{"))
		if res.StatusCode != 400 || body.Error.Code != "VALIDATION" {
			t.Errorf("status %d body %+v", res.StatusCode, body)
		}
	})
}

func TestByLoginEmail(t *testing.T) {
	// คีย์ rate limit ต้องเป็นอีเมลที่ normalize แล้ว → เปลี่ยนตัวพิมพ์หลบการนับไม่ได้
	app := fiber.New()
	app.Post("/", func(c fiber.Ctx) error { return c.SendString(byLoginEmail(c)) })
	for body, want := range map[string]string{
		`{"email":" Ton@Example.com "}`: "login:ton@example.com",
		`not json`:                      "login:",
	} {
		res, err := app.Test(httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body)))
		if err != nil {
			t.Fatal(err)
		}
		got, _ := io.ReadAll(res.Body)
		if string(got) != want {
			t.Errorf("byLoginEmail(%s) = %q; want %q", body, got, want)
		}
	}
}

func TestSignToken(t *testing.T) {
	h := newHandler(t)
	raw, err := h.signToken(&models.User{ID: 42, TokenVersion: 3})
	if err != nil {
		t.Fatal(err)
	}
	claims := &middleware.Claims{}
	tok, err := jwt.ParseWithClaims(raw, claims, func(*jwt.Token) (any, error) { return h.JWTSecret, nil },
		jwt.WithTimeFunc(func() time.Time { return testNow }))
	if err != nil {
		t.Fatal(err)
	}
	if tok.Method != jwt.SigningMethodHS256 || claims.Subject != "42" || claims.Ver != 3 {
		t.Errorf("alg %v sub %q ver %d", tok.Method.Alg(), claims.Subject, claims.Ver)
	}
	if got := claims.ExpiresAt.Sub(claims.IssuedAt.Time); got != tokenTTL {
		t.Errorf("อายุ token = %v; want %v", got, tokenTTL)
	}
}

// ---------- ร้าน ----------

func validRestaurant() restaurantInput {
	return restaurantInput{
		Name:              "ร้านทดสอบ",
		Cuisine:           "ไทย",
		Seats:             20,
		OpenTime:          "18:00",
		CloseTime:         "02:00",
		CancelLeadMinutes: 60,
		Images:            []string{"/uploads/a.jpg"},
	}
}

func TestRestaurantValidateOK(t *testing.T) {
	in := validRestaurant()
	in.Name = "  ร้านทดสอบ  "
	open, close, err := in.validate()
	if err != nil {
		t.Fatal(err)
	}
	if open != 1080 || close != 120 || in.Name != "ร้านทดสอบ" {
		t.Errorf("open %d close %d name %q", open, close, in.Name)
	}
}

func TestRestaurantValidateErrors(t *testing.T) {
	cases := []struct {
		name  string
		edit  func(*restaurantInput)
		field string
	}{
		{"ชื่อว่าง", func(r *restaurantInput) { r.Name = " " }, "name"},
		{"ชื่อยาวเกิน", func(r *restaurantInput) { r.Name = strings.Repeat("ก", 101) }, "name"},
		{"ประเภทยาวเกิน", func(r *restaurantInput) { r.Cuisine = strings.Repeat("ก", 101) }, "cuisine"},
		{"รายละเอียดยาวเกิน", func(r *restaurantInput) { r.Description = strings.Repeat("ก", 2001) }, "description"},
		{"ที่นั่ง 0", func(r *restaurantInput) { r.Seats = 0 }, "seats"},
		{"ที่นั่งเกินเพดาน", func(r *restaurantInput) { r.Seats = MaxSeats + 1 }, "seats"},
		{"ไม่มีเวลาเปิด", func(r *restaurantInput) { r.OpenTime = "" }, "openTime"},
		{"เวลาเปิดไม่ลง :30", func(r *restaurantInput) { r.OpenTime = "18:15" }, "openTime"},
		{"ไม่มีเวลาปิด", func(r *restaurantInput) { r.CloseTime = "25:00" }, "closeTime"},
		{"เวลาปิดไม่ลง :30", func(r *restaurantInput) { r.CloseTime = "02:45" }, "closeTime"},
		{"เปิด = ปิด", func(r *restaurantInput) { r.CloseTime = r.OpenTime }, "closeTime"},
		{"ยกเลิกล่วงหน้าน้อยไป", func(r *restaurantInput) { r.CancelLeadMinutes = 29 }, "cancelLeadMinutes"},
		{"ยกเลิกล่วงหน้าเกิน 7 วัน", func(r *restaurantInput) { r.CancelLeadMinutes = MaxCancelLeadMinutes + 1 }, "cancelLeadMinutes"},
		{"ไม่มีรูป", func(r *restaurantInput) { r.Images = nil }, "images"},
		{"รูปเกิน 8", func(r *restaurantInput) { r.Images = make([]string, 9) }, "images"},
		{"รูปจากเว็บอื่น", func(r *restaurantInput) { r.Images = []string{"https://evil.example/x.jpg"} }, "images"},
		{"รูปมี ..", func(r *restaurantInput) { r.Images = []string{"/uploads/../main.go"} }, "images"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			in := validRestaurant()
			c.edit(&in)
			_, _, err := in.validate()
			var e *apperr.Error
			if !errors.As(err, &e) || e.Code != "VALIDATION" {
				t.Fatalf("err = %v", err)
			}
			if fields, _ := e.Details.(map[string]string); fields[c.field] == "" {
				t.Errorf("details = %#v; want ช่อง %s", e.Details, c.field)
			}
		})
	}
}

func TestCreateRestaurantRejectsBeforeDB(t *testing.T) {
	app := newApp(newHandler(t))
	in := validRestaurant()
	in.Seats = 0
	res, body := sendJSON(t, app, http.MethodPost, "/restaurants", in)
	if res.StatusCode != 400 || body.Error.Details["seats"] == "" {
		t.Errorf("status %d body %+v", res.StatusCode, body)
	}
}

func TestImagesOf(t *testing.T) {
	got := imagesOf(7, []string{"/uploads/a.jpg", "/uploads/b.jpg"})
	if len(got) != 2 || got[0].Position != 0 || got[1].Position != 1 || got[1].RestaurantID != 7 || got[1].URL != "/uploads/b.jpg" {
		t.Errorf("imagesOf = %+v", got)
	}
	if got := imagesOf(1, nil); len(got) != 0 {
		t.Errorf("imagesOf(nil) = %+v", got)
	}
}

// ---------- พารามิเตอร์ :id ----------

func TestBadIDIs404(t *testing.T) {
	app := newApp(newHandler(t))
	for _, path := range []string{"/bookings/abc", "/bookings/0", "/bookings/-1", "/bookings/1.5"} {
		res, body := sendJSON(t, app, http.MethodPut, path, booking.Input{})
		if res.StatusCode != 404 || body.Error.Code != "NOT_FOUND" {
			t.Errorf("PUT %s: status %d body %+v", path, res.StatusCode, body)
		}
	}
	for _, path := range []string{"/restaurants/x/bookings", "/bookings/x/cancel"} {
		res, _ := sendJSON(t, app, http.MethodPost, path, booking.Input{})
		if res.StatusCode != 404 {
			t.Errorf("POST %s: status %d", path, res.StatusCode)
		}
	}
}

func TestBadBookingBody(t *testing.T) {
	app := newApp(newHandler(t))
	for _, path := range []string{"/restaurants/1/bookings", "/bookings/1"} {
		method := http.MethodPost
		if strings.HasPrefix(path, "/bookings") {
			method = http.MethodPut
		}
		// partySize เป็นข้อความ → แปลงเป็น int ไม่ได้
		res, body := send(t, app, method, path, "application/json", strings.NewReader(`{"partySize":"four"}`))
		if res.StatusCode != 400 || body.Error.Code != "VALIDATION" {
			t.Errorf("%s %s: status %d body %+v", method, path, res.StatusCode, body)
		}
	}
}

// ---------- DTO ----------

func TestToBookingDTO(t *testing.T) {
	b := &models.Booking{
		ID:           5,
		RestaurantID: 2,
		Restaurant:   models.Restaurant{ID: 2, Name: "ร้านดึก", CancelLeadMinutes: 120},
		PartySize:    4,
		ServiceDate:  time.Date(2026, 9, 25, 0, 0, 0, 0, time.UTC),
		StartAt:      time.Date(2026, 9, 26, 1, 0, 0, 0, booking.Loc), // รอบวันที่ 25 แต่เริ่มหลังเที่ยงคืน
		EndAt:        time.Date(2026, 9, 26, 2, 0, 0, 0, booking.Loc),
		Status:       models.StatusConfirmed,
	}
	dto := toBookingDTO(b, testNow)
	if dto.ServiceDate != "2026-09-25" || dto.Start != "01:00" || dto.End != "02:00" {
		t.Errorf("วันที่/เวลา = %s %s–%s", dto.ServiceDate, dto.Start, dto.End)
	}
	// เส้นตาย = 01:00 − 2 ชม. = 25 ก.ย. 23:00
	if dto.CancelDeadline != "23:00" || dto.CancelDeadlineDate != "2026-09-25" || !dto.CanCancel {
		t.Errorf("deadline %s %s canCancel %v", dto.CancelDeadlineDate, dto.CancelDeadline, dto.CanCancel)
	}
	if dto.RestaurantName != "ร้านดึก" || dto.CancelLeadMinutes != 120 {
		t.Errorf("dto = %+v", dto)
	}

	late := toBookingDTO(b, time.Date(2026, 9, 25, 23, 30, 0, 0, booking.Loc))
	if late.CanCancel {
		t.Error("เลยเส้นตายแล้วต้อง CanCancel = false")
	}
	b.Status = models.StatusCancelled
	if toBookingDTO(b, testNow).CanCancel {
		t.Error("ยกเลิกแล้วต้อง CanCancel = false")
	}
}

func TestToReviewDTO(t *testing.T) {
	r := &models.Review{ID: 1, UserID: 9, Rating: 5, User: models.User{Name: "ต้น"}}
	if dto := toReviewDTO(r, 9); !dto.IsMine || dto.UserName != "ต้น" || dto.Rating != 5 {
		t.Errorf("ของตัวเอง: %+v", dto)
	}
	if toReviewDTO(r, 8).IsMine {
		t.Error("คนอื่นต้อง IsMine = false")
	}
	// ไม่ได้ login (me = 0) ต้องไม่เป็น "ของฉัน" แม้ UserID ของรีวิวเป็น 0
	if toReviewDTO(&models.Review{}, 0).IsMine {
		t.Error("ไม่ได้ login ต้อง IsMine = false")
	}
}

// ---------- อัปโหลด ----------

func multipartFile(t *testing.T, field string, content []byte) (string, *bytes.Buffer) {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	fw, err := w.CreateFormFile(field, "photo.jpg")
	if err != nil {
		t.Fatal(err)
	}
	fw.Write(content)
	w.Close()
	return w.FormDataContentType(), &buf
}

var pngHeader = []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR")

func TestUpload(t *testing.T) {
	h := newHandler(t)
	app := newApp(h)

	t.Run("ไม่มีไฟล์", func(t *testing.T) {
		ct, body := multipartFile(t, "other", pngHeader)
		res, eb := send(t, app, http.MethodPost, "/uploads", ct, body)
		if res.StatusCode != 400 || eb.Error.Details["file"] == "" {
			t.Errorf("status %d body %+v", res.StatusCode, eb)
		}
	})

	t.Run("ไม่ใช่รูป แม้ชื่อไฟล์เป็น .jpg", func(t *testing.T) {
		ct, body := multipartFile(t, "file", []byte("<?php echo 1; ?>"))
		res, eb := send(t, app, http.MethodPost, "/uploads", ct, body)
		if res.StatusCode != 400 || eb.Error.Code != "UNSUPPORTED_FILE" {
			t.Errorf("status %d body %+v", res.StatusCode, eb)
		}
	})

	t.Run("ใหญ่เกิน 5MB", func(t *testing.T) {
		big := append(append([]byte{}, pngHeader...), make([]byte, maxUploadBytes)...)
		ct, body := multipartFile(t, "file", big)
		res, eb := send(t, app, http.MethodPost, "/uploads", ct, body)
		if res.StatusCode != 400 || eb.Error.Code != "UNSUPPORTED_FILE" {
			t.Errorf("status %d body %+v", res.StatusCode, eb)
		}
	})

	t.Run("PNG ตั้งชื่อใหม่แบบสุ่ม", func(t *testing.T) {
		ct, body := multipartFile(t, "file", pngHeader)
		req := httptest.NewRequest(http.MethodPost, "/uploads", body)
		req.Header.Set("Content-Type", ct)
		res, err := app.Test(req)
		if err != nil {
			t.Fatal(err)
		}
		var out struct{ URL string }
		json.NewDecoder(res.Body).Decode(&out)
		if res.StatusCode != 201 || !strings.HasPrefix(out.URL, "/uploads/") || !strings.HasSuffix(out.URL, ".png") {
			t.Fatalf("status %d url %q", res.StatusCode, out.URL)
		}
		name := strings.TrimPrefix(out.URL, "/uploads/")
		if !managedUpload.MatchString(name) {
			t.Errorf("ชื่อไฟล์ %q ไม่ตรงรูปแบบที่ CleanUploads จะเก็บกวาด", name)
		}
		if _, err := os.Stat(filepath.Join(h.UploadDir, name)); err != nil {
			t.Errorf("ไม่พบไฟล์ที่บันทึก: %v", err)
		}
	})
}

func TestRandomName(t *testing.T) {
	a, _ := randomName()
	b, _ := randomName()
	if len(a) != 32 || a == b {
		t.Errorf("randomName = %q, %q", a, b)
	}
}

func TestManagedUpload(t *testing.T) {
	yes := []string{
		"5d4bd203cdd3f61d2e01ac200a1e202f.jpg",
		"5d4bd203cdd3f61d2e01ac200a1e202f.webp",
		"seed-cafe-rim-na-1.jpg",
	}
	no := []string{
		".gitkeep",
		"main.go",
		"5d4bd203cdd3f61d2e01ac200a1e202.jpg",  // 31 ตัว
		"5D4BD203CDD3F61D2E01AC200A1E202F.jpg", // ตัวใหญ่
		"5d4bd203cdd3f61d2e01ac200a1e202f.gif",
		"seed-Cafe.jpg",
		"x/5d4bd203cdd3f61d2e01ac200a1e202f.jpg",
	}
	for _, n := range yes {
		if !managedUpload.MatchString(n) {
			t.Errorf("%q ควรเป็นไฟล์ที่ระบบจัดการ", n)
		}
	}
	for _, n := range no {
		if managedUpload.MatchString(n) {
			t.Errorf("%q ต้องไม่ถูกแตะ", n)
		}
	}
}

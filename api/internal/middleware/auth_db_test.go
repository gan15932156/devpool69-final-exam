package middleware

import (
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"toawang/internal/models"
	"toawang/internal/testdb"
)

func tokenFor(t *testing.T, id string, ver int) string {
	c := claims(id, time.Now().Add(time.Hour))
	c.Ver = ver
	return "Bearer " + sign(t, jwt.SigningMethodHS256, secret, c)
}

func body(t *testing.T, res *http.Response) string {
	t.Helper()
	b, _ := io.ReadAll(res.Body)
	return string(b)
}

func TestRequireAuthChecksTokenVersion(t *testing.T) {
	db := testdb.Open(t, "middleware")
	u := models.User{Name: "ต้น", Email: "ton@example.com", PasswordHash: "x", TokenVersion: 2}
	db.Create(&u)
	app := newApp(RequireAuth(secret, db))

	res := do(t, app, tokenFor(t, "1", 2))
	if got := body(t, res); res.StatusCode != 200 || got != "1" {
		t.Errorf("token ถูกต้อง: %d %q; want 200 \"1\"", res.StatusCode, got)
	}
	// เวอร์ชันเก่า (ก่อน logout) / ใหม่กว่าใน DB / user ไม่มี → 401
	for name, auth := range map[string]string{
		"เวอร์ชันเก่า": tokenFor(t, "1", 1),
		"เวอร์ชันปลอม": tokenFor(t, "1", 3),
		"user ไม่มี":   tokenFor(t, "99", 0),
	} {
		if res := do(t, app, auth); res.StatusCode != 401 {
			t.Errorf("%s: %d; want 401", name, res.StatusCode)
		}
	}
}

func TestOptionalAuthWithValidToken(t *testing.T) {
	db := testdb.Open(t, "middleware")
	db.Create(&models.User{Name: "ต้น", Email: "ton@example.com", PasswordHash: "x"})
	app := newApp(OptionalAuth(secret, db))
	if res := do(t, app, tokenFor(t, "1", 0)); body(t, res) != "1" {
		t.Error("login อยู่ต้องรู้ว่าเป็นใคร")
	}
	// token ใช้ไม่ได้ = เหมือนไม่ได้ login ไม่ใช่ error
	if res := do(t, app, tokenFor(t, "1", 5)); res.StatusCode != 200 || body(t, res) != "0" {
		t.Error("token เวอร์ชันผิดต้องผ่านแบบไม่ได้ login")
	}
}

func TestDatabaseDownIs500Not401(t *testing.T) {
	// DB สะดุด ≠ token ผิด → ตอบ 500 · ถ้าตอบ 401 หน้าเว็บจะเตะผู้ใช้ออกจากระบบ
	// ต่อพอร์ตที่ไม่มีใครฟัง โดยไม่ ping ตอนเปิด → ทุก query error · ไม่ต้องมี Postgres จริง
	down, err := gorm.Open(postgres.Open("postgres://x:x@127.0.0.1:1/x?sslmode=disable&connect_timeout=2"),
		&gorm.Config{DisableAutomaticPing: true, Logger: logger.Discard})
	if err != nil {
		t.Fatal(err)
	}
	for name, mw := range map[string]fiber.Handler{"RequireAuth": RequireAuth(secret, down), "OptionalAuth": OptionalAuth(secret, down)} {
		app := newApp(mw)
		if res := do(t, app, tokenFor(t, "1", 0)); res.StatusCode != 500 {
			t.Errorf("%s: %d; want 500", name, res.StatusCode)
		}
	}
}

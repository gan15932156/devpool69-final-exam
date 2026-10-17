package middleware

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"

	"toawang/internal/apperr"
)

var secret = []byte("test-secret-at-least-32-characters!!")

func sign(t *testing.T, method jwt.SigningMethod, key any, claims jwt.Claims) string {
	t.Helper()
	s, err := jwt.NewWithClaims(method, claims).SignedString(key)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func claims(sub string, exp time.Time) Claims {
	return Claims{RegisteredClaims: jwt.RegisteredClaims{
		Subject:   sub,
		ExpiresAt: jwt.NewNumericDate(exp),
	}}
}

// newApp — DB = nil: ทุกกรณีในไฟล์นี้ต้องถูกปฏิเสธก่อนถึงขั้นถาม DB
func newApp(h fiber.Handler) *fiber.App {
	app := fiber.New(fiber.Config{ErrorHandler: apperr.Handler})
	app.Get("/", h, func(c fiber.Ctx) error {
		return c.SendString(strconv.FormatUint(uint64(UserID(c)), 10))
	})
	return app
}

func do(t *testing.T, app *fiber.App, auth string) *http.Response {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	if auth != "" {
		req.Header.Set("Authorization", auth)
	}
	res, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	return res
}

func TestRequireAuthRejects(t *testing.T) {
	future := time.Now().Add(time.Hour)
	cases := map[string]string{
		"ไม่มี header":      "",
		"ไม่ใช่ Bearer":     "Basic dXNlcjpwYXNz",
		"Bearer ว่าง":       "Bearer ",
		"ไม่ใช่ JWT":        "Bearer not-a-token",
		"กุญแจผิด":          "Bearer " + sign(t, jwt.SigningMethodHS256, []byte("other-secret-other-secret-other!!"), claims("1", future)),
		"alg none":          "Bearer " + sign(t, jwt.SigningMethodNone, jwt.UnsafeAllowNoneSignatureType, claims("1", future)),
		"HS512 แทน HS256":   "Bearer " + sign(t, jwt.SigningMethodHS512, secret, claims("1", future)),
		"หมดอายุแล้ว":       "Bearer " + sign(t, jwt.SigningMethodHS256, secret, claims("1", time.Now().Add(-time.Minute))),
		"ไม่มีวันหมดอายุ":   "Bearer " + sign(t, jwt.SigningMethodHS256, secret, Claims{RegisteredClaims: jwt.RegisteredClaims{Subject: "1"}}),
		"subject ไม่ใช่เลข": "Bearer " + sign(t, jwt.SigningMethodHS256, secret, claims("abc", future)),
	}
	app := newApp(RequireAuth(secret, nil))
	for name, auth := range cases {
		t.Run(name, func(t *testing.T) {
			if res := do(t, app, auth); res.StatusCode != http.StatusUnauthorized {
				t.Errorf("status = %d; want 401", res.StatusCode)
			}
		})
	}
}

func TestOptionalAuthWithoutToken(t *testing.T) {
	app := newApp(OptionalAuth(secret, nil))
	for _, auth := range []string{"", "Bearer garbage"} {
		res := do(t, app, auth)
		buf := make([]byte, 8)
		n, _ := res.Body.Read(buf)
		if res.StatusCode != http.StatusOK || string(buf[:n]) != "0" {
			t.Errorf("auth %q: status %d body %q; want 200 \"0\"", auth, res.StatusCode, buf[:n])
		}
	}
}

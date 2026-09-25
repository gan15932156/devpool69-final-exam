package middleware

import (
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"

	"toawang/internal/apperr"
)

const userIDKey = "userID"

// parseToken อ่าน "Authorization: Bearer <token>" แล้วคืน userID (0 = ไม่มี/ไม่ถูกต้อง)
func parseToken(c fiber.Ctx, secret []byte) uint {
	raw, ok := strings.CutPrefix(c.Get("Authorization"), "Bearer ")
	if !ok || raw == "" {
		return 0
	}
	claims := &jwt.RegisteredClaims{}
	_, err := jwt.ParseWithClaims(raw, claims,
		func(*jwt.Token) (any, error) { return secret, nil },
		jwt.WithValidMethods([]string{"HS256"}), // กัน token ที่ใช้ alg อื่น เช่น "none"
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		return 0
	}
	id, err := strconv.ParseUint(claims.Subject, 10, 64)
	if err != nil {
		return 0
	}
	return uint(id)
}

// RequireAuth — route ที่ต้อง login · ไม่มี token หรือ token ผิด → 401
func RequireAuth(secret []byte) fiber.Handler {
	return func(c fiber.Ctx) error {
		id := parseToken(c, secret)
		if id == 0 {
			return apperr.Unauthorized()
		}
		c.Locals(userIDKey, id)
		return c.Next()
	}
}

// OptionalAuth — route ที่ใครก็เรียกได้ แต่ถ้า login อยู่จะรู้ว่าเป็นใคร (เช่น หน้าร้านต้องรู้ว่าเป็นเจ้าของไหม)
func OptionalAuth(secret []byte) fiber.Handler {
	return func(c fiber.Ctx) error {
		if id := parseToken(c, secret); id != 0 {
			c.Locals(userIDKey, id)
		}
		return c.Next()
	}
}

// UserID คืน id ของคนที่ login (0 = ไม่ได้ login)
func UserID(c fiber.Ctx) uint {
	id, _ := c.Locals(userIDKey).(uint)
	return id
}

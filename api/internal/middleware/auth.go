package middleware

import (
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"

	"toawang/internal/apperr"
	"toawang/internal/models"
)

const userIDKey = "userID"

// Claims = ข้อมูลใน token · Ver ต้องตรงกับ users.token_version ตอนใช้งาน
// logout → token_version ขยับ → token ที่ออกไปก่อนหน้าใช้ไม่ได้ทันที ไม่ต้องรอหมดอายุ 7 วัน
// แลกกับต้องถาม DB ทุกคำขอ (คอลัมน์เดียว) · JWT ล้วน ๆ ไม่ถาม DB เลย แต่ logout แล้ว token ยังใช้ได้จนหมดอายุ
type Claims struct {
	jwt.RegisteredClaims
	Ver int `json:"ver"`
}

// parseToken อ่าน "Authorization: Bearer <token>" แล้วคืน userID (0 = ไม่มี/ไม่ถูกต้อง/ถูกยกเลิกแล้ว)
// error = ถาม DB ไม่ได้ (ไม่ใช่ token ผิด) → ตอบ 500 แทน 401 จะได้ไม่เตะผู้ใช้ออกตอน DB สะดุด
func parseToken(c fiber.Ctx, secret []byte, db *gorm.DB) (uint, error) {
	raw, ok := strings.CutPrefix(c.Get("Authorization"), "Bearer ")
	if !ok || raw == "" {
		return 0, nil
	}
	claims := &Claims{}
	_, err := jwt.ParseWithClaims(raw, claims,
		func(*jwt.Token) (any, error) { return secret, nil },
		jwt.WithValidMethods([]string{"HS256"}), // กัน token ที่ใช้ alg อื่น เช่น "none"
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		return 0, nil
	}
	id, err := strconv.ParseUint(claims.Subject, 10, 64)
	if err != nil {
		return 0, nil
	}
	// เทียบเวอร์ชันกับ DB: user ถูกลบไปแล้ว หรือ logout ไปแล้ว → ใช้ไม่ได้
	var versions []int
	if err := db.Model(&models.User{}).Where("id = ?", id).Pluck("token_version", &versions).Error; err != nil {
		return 0, err
	}
	if len(versions) == 0 || versions[0] != claims.Ver {
		return 0, nil
	}
	return uint(id), nil
}

// RequireAuth — route ที่ต้อง login · ไม่มี token หรือ token ผิด → 401
func RequireAuth(secret []byte, db *gorm.DB) fiber.Handler {
	return func(c fiber.Ctx) error {
		id, err := parseToken(c, secret, db)
		if err != nil {
			return err
		}
		if id == 0 {
			return apperr.Unauthorized()
		}
		c.Locals(userIDKey, id)
		return c.Next()
	}
}

// OptionalAuth — route ที่ใครก็เรียกได้ แต่ถ้า login อยู่จะรู้ว่าเป็นใคร (เช่น หน้าร้านต้องรู้ว่าเป็นเจ้าของไหม)
func OptionalAuth(secret []byte, db *gorm.DB) fiber.Handler {
	return func(c fiber.Ctx) error {
		id, err := parseToken(c, secret, db)
		if err != nil {
			return err
		}
		if id != 0 {
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

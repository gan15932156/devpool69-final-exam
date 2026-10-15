package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"net/mail"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"toawang/internal/apperr"
	"toawang/internal/middleware"
	"toawang/internal/models"
)

// tokenTTL 7 วัน → ไม่ต้อง login บ่อย · token หลุดก็ยกเลิกได้ทันทีด้วย logout (TokenVersion)
// ต้องเท่ากับ session maxAge ใน web/auth.ts ไม่งั้น cookie ยังอยู่แต่ token ข้างในหมดอายุแล้ว
const tokenTTL = 7 * 24 * time.Hour

var (
	errEmailTaken   = apperr.New(http.StatusConflict, "EMAIL_TAKEN", "อีเมลนี้มีบัญชีอยู่แล้ว")
	errInvalidLogin = apperr.New(http.StatusUnauthorized, "UNAUTHORIZED", "อีเมลหรือรหัสผ่านไม่ถูกต้อง")
)

type registerRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authResponse struct {
	User        models.User `json:"user"`
	AccessToken string      `json:"accessToken"`
}

// normalizeEmail ตัดช่องว่าง + ทำเป็นตัวเล็ก ก่อนเก็บและก่อนค้น
// unique index ของ Postgres แยกตัวพิมพ์ใหญ่–เล็ก → ถ้าไม่ทำ A@x.com กับ a@x.com จะสมัครซ้ำกันได้
func normalizeEmail(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

func (h *Handler) Register(c fiber.Ctx) error {
	var req registerRequest
	if err := c.Bind().Body(&req); err != nil {
		return apperr.BadBody()
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Email = normalizeEmail(req.Email)

	fields := map[string]string{}
	if req.Name == "" || utf8.RuneCountInString(req.Name) > MaxNameLength {
		fields["name"] = fmt.Sprintf("กรุณากรอกชื่อที่แสดง (ไม่เกิน %d ตัวอักษร)", MaxNameLength)
	}
	// ParseAddress รับแบบ "ชื่อ <a@b.com>" ด้วย → เทียบผลกับที่พิมพ์มา = รับเฉพาะอีเมลเปล่า ๆ
	if addr, err := mail.ParseAddress(req.Email); err != nil || addr.Address != req.Email {
		fields["email"] = "รูปแบบอีเมลไม่ถูกต้อง"
	}
	// ขั้นต่ำนับเป็นตัวอักษร (ภาษาไทย 1 ตัว = 3 byte) · เพดานนับเป็น byte เพราะ bcrypt ใช้ได้แค่ 72 byte แรก
	hasDigit := strings.IndexFunc(req.Password, unicode.IsDigit) >= 0
	switch {
	case utf8.RuneCountInString(req.Password) < 8 || !hasDigit:
		fields["password"] = "รหัสผ่านต้องมีอย่างน้อย 8 ตัวและมีตัวเลข"
	case len(req.Password) > 72: // bcrypt รับได้ไม่เกิน 72 byte
		fields["password"] = "รหัสผ่านยาวเกินไป"
	}
	if len(fields) > 0 {
		return apperr.Validation(fields)
	}

	// bcrypt ไม่ใช่ SHA-256: ตั้งใจให้ช้าและมี salt ในตัว → DB หลุดไปก็ไล่เดารหัสทีละมาก ๆ ไม่ได้
	// DefaultCost (10) ช้าพอจะกันการเดา แต่ผู้ใช้ไม่รู้สึกตอน login
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	user := models.User{Name: req.Name, Email: req.Email, PasswordHash: string(hash)}
	if err := h.DB.Create(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return errEmailTaken
		}
		return err
	}

	token, err := h.signToken(&user)
	if err != nil {
		return err
	}
	return c.Status(http.StatusCreated).JSON(authResponse{User: user, AccessToken: token})
}

func (h *Handler) Login(c fiber.Ctx) error {
	var req loginRequest
	if err := c.Bind().Body(&req); err != nil {
		return apperr.BadBody()
	}

	var user models.User
	err := h.DB.Where("email = ?", normalizeEmail(req.Email)).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return errInvalidLogin // ไม่บอกว่า "ไม่มีอีเมลนี้" — กันคนเดาว่าใครมีบัญชี
	}
	if err != nil {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)) != nil {
		return errInvalidLogin
	}

	token, err := h.signToken(&user)
	if err != nil {
		return err
	}
	return c.JSON(authResponse{User: user, AccessToken: token})
}

// POST /auth/logout — ยกเลิก token ทุกตัวของบัญชีนี้ทันที (เลขเวอร์ชันใน DB ขยับ → ไม่ตรงกับใน token เก่า)
// หน้าเว็บเรียกตอนกดออกจากระบบ · ไม่งั้น token ที่หลุดไปยังใช้ได้จนหมดอายุ 7 วัน
func (h *Handler) Logout(c fiber.Ctx) error {
	err := h.DB.Model(&models.User{}).Where("id = ?", middleware.UserID(c)).
		Update("token_version", gorm.Expr("token_version + 1")).Error
	if err != nil {
		return err
	}
	return c.SendStatus(http.StatusNoContent)
}

func (h *Handler) Me(c fiber.Ctx) error {
	var user models.User
	if err := h.DB.First(&user, middleware.UserID(c)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperr.Unauthorized() // token ถูกแต่ user ถูกลบไปแล้ว
		}
		return err
	}
	return c.JSON(user)
}

// signToken ใช้ HS256 (กุญแจเดียวทั้งเซ็นและตรวจ) เพราะ Go เป็นที่เดียวที่เซ็นและตรวจ token
// ไม่ต้องใช้คู่กุญแจแบบ RS256 ซึ่งมีไว้ให้ระบบอื่นตรวจ token ได้โดยไม่ต้องรู้กุญแจเซ็น
func (h *Handler) signToken(user *models.User) (string, error) {
	now := h.Now()
	claims := middleware.Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.FormatUint(uint64(user.ID), 10),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(tokenTTL)),
		},
		Ver: user.TokenVersion,
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(h.JWTSecret)
}

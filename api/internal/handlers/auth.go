package handlers

import (
	"errors"
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
	if req.Name == "" {
		fields["name"] = "กรุณากรอกชื่อที่แสดง"
	}
	if addr, err := mail.ParseAddress(req.Email); err != nil || addr.Address != req.Email {
		fields["email"] = "รูปแบบอีเมลไม่ถูกต้อง"
	}
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

	token, err := h.signToken(user.ID)
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

	token, err := h.signToken(user.ID)
	if err != nil {
		return err
	}
	return c.JSON(authResponse{User: user, AccessToken: token})
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

func (h *Handler) signToken(userID uint) (string, error) {
	now := h.Now()
	claims := jwt.RegisteredClaims{
		Subject:   strconv.FormatUint(uint64(userID), 10),
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(tokenTTL)),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(h.JWTSecret)
}

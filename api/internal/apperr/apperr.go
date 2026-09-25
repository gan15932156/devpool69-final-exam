package apperr

import (
	"errors"
	"log"
	"net/http"

	"github.com/gofiber/fiber/v3"
)

// Error คือ error ที่ตั้งใจส่งกลับไปให้หน้าเว็บ
// ทุก error ของ API จะออกมาหน้าตาเดียวกัน: { "error": { "code", "message", "details" } }
type Error struct {
	Status  int    `json:"-"`
	Code    string `json:"code"`
	Message string `json:"message"`
	Details any    `json:"details"`
}

func (e *Error) Error() string { return e.Code + ": " + e.Message }

func New(status int, code, message string) *Error {
	return &Error{Status: status, Code: code, Message: message}
}

// WithDetails คืนสำเนาใหม่พร้อม details (ไม่แก้ตัวเดิม)
func (e *Error) WithDetails(details any) *Error {
	cp := *e
	cp.Details = details
	return &cp
}

// Validation ใช้เมื่อข้อมูลที่ส่งมาผิด · fields = { "ชื่อช่อง": "ข้อความ" }
func Validation(fields map[string]string) *Error {
	return New(http.StatusBadRequest, "VALIDATION", "ข้อมูลไม่ถูกต้อง").WithDetails(fields)
}

func BadBody() *Error {
	return New(http.StatusBadRequest, "VALIDATION", "รูปแบบข้อมูลไม่ถูกต้อง")
}

func Unauthorized() *Error {
	return New(http.StatusUnauthorized, "UNAUTHORIZED", "กรุณาเข้าสู่ระบบ")
}

func Forbidden() *Error {
	return New(http.StatusForbidden, "FORBIDDEN", "คุณไม่มีสิทธิ์ทำรายการนี้")
}

func NotFound(what string) *Error {
	return New(http.StatusNotFound, "NOT_FOUND", "ไม่พบ"+what)
}

// Handler ใส่ใน fiber.Config.ErrorHandler — ทุก error ที่ handler return ออกมาจะผ่านตรงนี้
func Handler(c fiber.Ctx, err error) error {
	var appErr *Error
	if errors.As(err, &appErr) {
		return c.Status(appErr.Status).JSON(fiber.Map{"error": appErr})
	}

	// error ของ Fiber เอง เช่น ไม่มี route (404), body ใหญ่เกิน (413)
	var fe *fiber.Error
	if errors.As(err, &fe) {
		code := "INTERNAL"
		switch fe.Code {
		case http.StatusNotFound:
			code = "NOT_FOUND"
		case http.StatusMethodNotAllowed:
			code = "METHOD_NOT_ALLOWED"
		case http.StatusRequestEntityTooLarge:
			code = "PAYLOAD_TOO_LARGE"
		case http.StatusBadRequest, http.StatusUnprocessableEntity:
			code = "VALIDATION"
		}
		return c.Status(fe.Code).JSON(fiber.Map{"error": &Error{Code: code, Message: fe.Message}})
	}

	// อย่างอื่น = bug ของเรา → log ไว้ดู แต่ไม่ส่งรายละเอียดออกไป
	log.Printf("internal error on %s %s: %v", c.Method(), c.Path(), err)
	return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
		"error": &Error{Code: "INTERNAL", Message: "เกิดข้อผิดพลาดในระบบ"},
	})
}

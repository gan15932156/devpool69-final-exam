package apperr

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v3"
)

func TestWithDetailsCopies(t *testing.T) {
	base := New(http.StatusConflict, "X", "msg")
	got := base.WithDetails(map[string]int{"n": 1})
	if base.Details != nil {
		t.Errorf("ตัวเดิมถูกแก้: %#v", base.Details)
	}
	if got == base || got.Code != "X" || got.Status != http.StatusConflict || got.Details == nil {
		t.Errorf("สำเนา = %#v", got)
	}
}

func TestErrorString(t *testing.T) {
	if got := New(400, "CODE", "ข้อความ").Error(); got != "CODE: ข้อความ" {
		t.Errorf("Error() = %q", got)
	}
}

func TestAsFiberError(t *testing.T) {
	// limiter ของ Fiber หา *fiber.Error เพื่อดู status · ต้องเห็น status จริงของ apperr
	err := fmt.Errorf("wrap: %w", Forbidden())
	var fe *fiber.Error
	if !errors.As(err, &fe) || fe.Code != http.StatusForbidden {
		t.Fatalf("errors.As → %v", fe)
	}
	var other *json.SyntaxError
	if errors.As(Forbidden(), &other) {
		t.Error("ไม่ควรแปลงเป็นชนิดอื่น")
	}
}

func TestHelpers(t *testing.T) {
	cases := []struct {
		err    *Error
		status int
		code   string
	}{
		{Validation(map[string]string{"a": "b"}), 400, "VALIDATION"},
		{BadBody(), 400, "VALIDATION"},
		{Unauthorized(), 401, "UNAUTHORIZED"},
		{Forbidden(), 403, "FORBIDDEN"},
		{NotFound("ร้าน"), 404, "NOT_FOUND"},
	}
	for _, c := range cases {
		if c.err.Status != c.status || c.err.Code != c.code {
			t.Errorf("%s: status %d code %s", c.err.Message, c.err.Status, c.err.Code)
		}
	}
	if NotFound("ร้าน").Message != "ไม่พบร้าน" {
		t.Errorf("NotFound message = %q", NotFound("ร้าน").Message)
	}
}

type errorBody struct {
	Error struct {
		Code    string          `json:"code"`
		Message string          `json:"message"`
		Details json.RawMessage `json:"details"`
	} `json:"error"`
}

// call ยิงคำขอไปยัง route ที่ return err แล้วอ่าน status + body
func call(t *testing.T, err error) (int, errorBody) {
	t.Helper()
	app := fiber.New(fiber.Config{ErrorHandler: Handler})
	app.Get("/", func(fiber.Ctx) error { return err })
	res, testErr := app.Test(httptest.NewRequest(http.MethodGet, "/", nil))
	if testErr != nil {
		t.Fatal(testErr)
	}
	defer res.Body.Close()
	var body errorBody
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	return res.StatusCode, body
}

func TestHandler(t *testing.T) {
	t.Run("apperr พร้อม details", func(t *testing.T) {
		status, body := call(t, Validation(map[string]string{"name": "ว่าง"}))
		if status != 400 || body.Error.Code != "VALIDATION" || string(body.Error.Details) != `{"name":"ว่าง"}` {
			t.Errorf("%d %+v", status, body)
		}
	})
	t.Run("apperr ที่ถูก wrap", func(t *testing.T) {
		status, body := call(t, fmt.Errorf("ctx: %w", NotFound("ร้าน")))
		if status != 404 || body.Error.Code != "NOT_FOUND" {
			t.Errorf("%d %+v", status, body)
		}
	})

	fiberCases := []struct {
		status int
		code   string
	}{
		{404, "NOT_FOUND"},
		{405, "METHOD_NOT_ALLOWED"},
		{413, "PAYLOAD_TOO_LARGE"},
		{400, "VALIDATION"},
		{422, "VALIDATION"},
		{503, "INTERNAL"},
	}
	for _, c := range fiberCases {
		t.Run(fmt.Sprintf("fiber %d", c.status), func(t *testing.T) {
			status, body := call(t, fiber.NewError(c.status, "x"))
			if status != c.status || body.Error.Code != c.code {
				t.Errorf("%d %+v; want %d %s", status, body, c.status, c.code)
			}
		})
	}

	t.Run("error อื่น = 500 ไม่เผยรายละเอียด", func(t *testing.T) {
		status, body := call(t, errors.New("pq: password=secret"))
		if status != 500 || body.Error.Code != "INTERNAL" || body.Error.Message != "เกิดข้อผิดพลาดในระบบ" {
			t.Errorf("%d %+v", status, body)
		}
	})
}

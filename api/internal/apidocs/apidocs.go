package apidocs

import (
	_ "embed"

	"github.com/gofiber/fiber/v3"
)

// ฝังไฟล์ไว้ในโปรแกรม → image Docker ไม่ต้อง copy ไฟล์ตามไปด้วย
//
//go:embed openapi.yaml
var spec []byte

//go:embed index.html
var page []byte

// Routes เปิด Swagger UI ที่ /docs · spec อยู่ที่ /docs/openapi.yaml (แก้ spec ที่ไฟล์ openapi.yaml ข้างกันนี้)
func Routes(app *fiber.App) {
	app.Get("/docs", func(c fiber.Ctx) error {
		c.Set(fiber.HeaderContentType, fiber.MIMETextHTMLCharsetUTF8)
		return c.Send(page)
	})
	app.Get("/docs/openapi.yaml", func(c fiber.Ctx) error {
		c.Set(fiber.HeaderContentType, "application/yaml; charset=utf-8")
		return c.Send(spec)
	})
}

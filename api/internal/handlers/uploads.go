package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gofiber/fiber/v3"

	"toawang/internal/apperr"
)

const maxUploadBytes = 5 << 20 // 5MB

// ชนิดไฟล์ที่รับ → นามสกุลที่จะใช้บันทึก
var allowedImageTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

var errUnsupportedFile = apperr.New(http.StatusBadRequest, "UNSUPPORTED_FILE", "รับเฉพาะรูป JPG, PNG, WEBP ขนาดไม่เกิน 5MB")

// POST /uploads (multipart, ช่องชื่อ "file") → { "url": "/uploads/<ชื่อสุ่ม>.jpg" }
func (h *Handler) Upload(c fiber.Ctx) error {
	fh, err := c.FormFile("file")
	if err != nil {
		return apperr.Validation(map[string]string{"file": "กรุณาเลือกไฟล์รูป"})
	}
	if fh.Size > maxUploadBytes {
		return errUnsupportedFile
	}

	// ดูชนิดไฟล์จาก "เนื้อไฟล์" 512 byte แรก ไม่เชื่อนามสกุลหรือ Content-Type ที่ผู้ใช้ส่งมา
	f, err := fh.Open()
	if err != nil {
		return err
	}
	head := make([]byte, 512)
	n, _ := io.ReadFull(f, head)
	f.Close()
	ext, ok := allowedImageTypes[http.DetectContentType(head[:n])]
	if !ok {
		return errUnsupportedFile
	}

	// ตั้งชื่อใหม่แบบสุ่ม — ไม่ใช้ชื่อที่ผู้ใช้ส่งมา (กันชื่ออย่าง ../../main.go)
	name, err := randomName()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(h.UploadDir, 0o755); err != nil {
		return err
	}
	if err := c.SaveFile(fh, filepath.Join(h.UploadDir, name+ext)); err != nil {
		return err
	}
	return c.Status(http.StatusCreated).JSON(fiber.Map{"url": "/uploads/" + name + ext})
}

func randomName() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

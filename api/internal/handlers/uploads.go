package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"time"

	"github.com/gofiber/fiber/v3"

	"toawang/internal/apperr"
	"toawang/internal/models"
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

// ไฟล์ที่ระบบตั้งชื่อเอง: รูปที่อัปโหลด (hex สุ่ม 32 ตัว) และรูป seed · ไฟล์ชื่ออื่นไม่แตะเด็ดขาด
// (เผื่อ UPLOAD_DIR ถูกตั้งผิดไปชี้โฟลเดอร์อื่น จะได้ไม่ลบไฟล์ที่ไม่ใช่ของเรา)
var managedUpload = regexp.MustCompile(`^([0-9a-f]{32}|seed-[a-z0-9-]+)\.(jpg|png|webp)$`)

// CleanUploads ลบรูปที่ไม่มีร้านไหนใช้และเก่ากว่า OrphanUploadAge ทุก ๆ every (รันใน goroutine ตลอดอายุ API)
// รูปกำพร้าเกิดจาก: อัปโหลดแล้วไม่กดบันทึก / เปลี่ยนรูปร้าน / ลบร้าน · ไม่ลบ = ดิสก์เต็มได้
func (h *Handler) CleanUploads(every time.Duration) {
	for {
		if n, err := h.removeOrphanUploads(); err != nil {
			log.Printf("clean uploads: %v", err)
		} else if n > 0 {
			log.Printf("clean uploads: ลบรูปที่ไม่มีร้านใช้ %d ไฟล์", n)
		}
		time.Sleep(every)
	}
}

func (h *Handler) removeOrphanUploads() (int, error) {
	entries, err := os.ReadDir(h.UploadDir)
	if errors.Is(err, fs.ErrNotExist) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	var urls []string
	if err := h.DB.Model(&models.RestaurantImage{}).Pluck("url", &urls).Error; err != nil {
		return 0, err
	}
	inUse := make(map[string]bool, len(urls))
	for _, u := range urls {
		inUse[path.Base(u)] = true // "/uploads/abc.jpg" → "abc.jpg"
	}

	cutoff := h.Now().Add(-OrphanUploadAge)
	removed := 0
	for _, e := range entries {
		name := e.Name()
		if e.IsDir() || !managedUpload.MatchString(name) || inUse[name] {
			continue
		}
		info, err := e.Info()
		if err != nil || info.ModTime().After(cutoff) {
			continue
		}
		if err := os.Remove(filepath.Join(h.UploadDir, name)); err == nil {
			removed++
		}
	}
	return removed, nil
}

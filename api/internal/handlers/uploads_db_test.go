package handlers

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"toawang/internal/models"
	"toawang/internal/seed"
	"toawang/internal/testdb"
)

// removeOrphanUploads ลบไฟล์จริง → ต้องลบเฉพาะรูปที่ไม่มีร้านใช้ + เก่าพอ + ชื่อเป็นของระบบเท่านั้น

func writeFile(t *testing.T, dir, name string, age time.Duration) {
	t.Helper()
	p := filepath.Join(dir, name)
	if err := os.WriteFile(p, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	old := time.Now().Add(-age)
	if err := os.Chtimes(p, old, old); err != nil {
		t.Fatal(err)
	}
}

func TestRemoveOrphanUploads(t *testing.T) {
	db := testdb.Open(t, "handlers")
	h := &Handler{DB: db, UploadDir: t.TempDir(), Now: time.Now}

	owner := models.User{Name: "o", Email: "o@example.com", PasswordHash: "x"}
	db.Create(&owner)
	shop := models.Restaurant{OwnerID: owner.ID, Name: "ร้าน", Seats: 1, OpenMinute: 660, CloseMinute: 1320, CancelLeadMinutes: 30,
		Images: []models.RestaurantImage{
			{URL: "/uploads/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg"},
			{URL: "/uploads/seed-krua-tai-1.jpg", Position: 1},
		}}
	if err := db.Create(&shop).Error; err != nil {
		t.Fatal(err)
	}

	old := 2 * OrphanUploadAge
	fresh := time.Minute
	writeFile(t, h.UploadDir, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg", old)   // ร้านใช้อยู่
	writeFile(t, h.UploadDir, "seed-krua-tai-1.jpg", old)                    // ร้านใช้อยู่ (รูป seed)
	writeFile(t, h.UploadDir, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.png", old)   // กำพร้า + เก่า → ลบ
	writeFile(t, h.UploadDir, "seed-old-shop-1.webp", old)                   // รูป seed ที่ไม่มีร้านใช้แล้ว → ลบ
	writeFile(t, h.UploadDir, "cccccccccccccccccccccccccccccccc.jpg", fresh) // กำพร้าแต่เพิ่งอัปโหลด (กำลังกรอกฟอร์ม)
	writeFile(t, h.UploadDir, ".gitkeep", old)                               // ไม่ใช่ไฟล์ของระบบ
	writeFile(t, h.UploadDir, "notes.txt", old)
	if err := os.Mkdir(filepath.Join(h.UploadDir, "dddddddddddddddddddddddddddddddd.jpg"), 0o755); err != nil {
		t.Fatal(err)
	}

	n, err := h.removeOrphanUploads()
	if err != nil {
		t.Fatal(err)
	}
	if n != 2 {
		t.Errorf("ลบ %d ไฟล์; want 2", n)
	}
	gone := map[string]bool{"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.png": true, "seed-old-shop-1.webp": true}
	for _, name := range []string{
		"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg", "seed-krua-tai-1.jpg", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.png",
		"seed-old-shop-1.webp", "cccccccccccccccccccccccccccccccc.jpg", ".gitkeep", "notes.txt", "dddddddddddddddddddddddddddddddd.jpg",
	} {
		_, err := os.Stat(filepath.Join(h.UploadDir, name))
		if exists := err == nil; exists == gone[name] {
			t.Errorf("%s: มีอยู่ = %v; want %v", name, exists, !gone[name])
		}
	}

	// รอบสองไม่มีอะไรให้ลบ
	if n, _ := h.removeOrphanUploads(); n != 0 {
		t.Errorf("รอบสองลบ %d ไฟล์", n)
	}
}

func TestRemoveOrphanUploadsMissingDir(t *testing.T) {
	h := &Handler{UploadDir: filepath.Join(t.TempDir(), "missing"), Now: time.Now} // ไม่ถึงขั้นถาม DB
	if n, err := h.removeOrphanUploads(); n != 0 || err != nil {
		t.Errorf("โฟลเดอร์ไม่มี: %d %v; want 0 nil", n, err)
	}
}

func TestSeedImagesAreManaged(t *testing.T) {
	// seedFileName ต้องเข้ารูปแบบ managedUpload ไม่งั้นรูป seed ที่เลิกใช้จะค้างอยู่ตลอดไป
	dir := t.TempDir()
	if err := seed.EnsureImages(dir); err != nil {
		t.Fatal(err)
	}
	entries, _ := os.ReadDir(dir)
	if len(entries) == 0 {
		t.Fatal("ไม่มีรูป seed")
	}
	for _, e := range entries {
		if !managedUpload.MatchString(e.Name()) {
			t.Errorf("รูป seed %q ไม่ตรง managedUpload", e.Name())
		}
	}
}

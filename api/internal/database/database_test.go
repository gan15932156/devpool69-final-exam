// package database_test (ไม่ใช่ database) เพราะ testdb import database อยู่แล้ว → กัน import วน
package database_test

import (
	"encoding/hex"
	"sync"
	"testing"

	"toawang/internal/database"
	"toawang/internal/models"
	"toawang/internal/testdb"
)

func TestJWTSecretIsStable(t *testing.T) {
	db := testdb.Open(t, "database")
	db.Where("1 = 1").Delete(&models.AppSecret{}) // testdb ไม่ล้าง app_secrets ให้

	first, err := database.JWTSecret(db)
	if err != nil {
		t.Fatal(err)
	}
	if raw, err := hex.DecodeString(string(first)); err != nil || len(raw) != 32 {
		t.Errorf("กุญแจ = %q; want hex ของ 32 byte", first)
	}
	// restart แล้วต้องได้กุญแจเดิม ไม่งั้น token ทุกตัวใช้ไม่ได้ (ทุกคนหลุด login)
	second, err := database.JWTSecret(db)
	if err != nil || string(second) != string(first) {
		t.Errorf("เรียกครั้งที่สอง = %q, %v; want %q", second, err, first)
	}

	// TRUNCATE ของ testdb (เหมือน seed reset) ต้องไม่ล้างกุญแจ
	testdb.Open(t, "database")
	if third, _ := database.JWTSecret(db); string(third) != string(first) {
		t.Error("ล้างข้อมูลแล้วกุญแจเปลี่ยน")
	}
}

func TestJWTSecretConcurrentStart(t *testing.T) {
	// API หลายตัวเริ่มพร้อมกันกับ DB ใหม่ → ต้องได้กุญแจเดียวกันหมด
	db := testdb.Open(t, "database")
	db.Where("1 = 1").Delete(&models.AppSecret{})

	const n = 10
	keys := make([]string, n)
	errs := make([]error, n)
	var wg sync.WaitGroup
	for i := range n {
		wg.Add(1)
		go func() {
			defer wg.Done()
			k, err := database.JWTSecret(db)
			keys[i], errs[i] = string(k), err
		}()
	}
	wg.Wait()
	for i := range n {
		if errs[i] != nil || keys[i] != keys[0] {
			t.Errorf("ตัวที่ %d: %q, %v; want %q", i, keys[i], errs[i], keys[0])
		}
	}
	var count int64
	db.Model(&models.AppSecret{}).Count(&count)
	if count != 1 {
		t.Errorf("app_secrets มี %d แถว; want 1", count)
	}
}

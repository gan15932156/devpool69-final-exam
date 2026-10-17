package seed

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"toawang/internal/booking"
	"toawang/internal/database"
	"toawang/internal/models"
	"toawang/internal/testdb"
)

// seed คือข้อมูลที่ใช้ present · test นี้กันไม่ให้ seed พังหรือเคสเดโมเพี้ยนโดยไม่รู้ตัว

func count(t *testing.T, db *gorm.DB, model any) int64 {
	t.Helper()
	var n int64
	if err := db.Model(model).Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

func runSeed(t *testing.T) (*gorm.DB, string) {
	t.Helper()
	db := testdb.Open(t, "seed")
	dir := t.TempDir()
	if err := Run(db, dir); err != nil {
		t.Fatalf("seed: %v", err)
	}
	return db, dir
}

// TestRun seed ครั้งเดียวแล้วตรวจหลายเรื่อง (seed หนึ่งรอบใช้หลายวินาที) · ลำดับสำคัญ: สองเรื่องท้ายรัน Run ซ้ำ
func TestRun(t *testing.T) {
	db, dir := runSeed(t)
	t.Run("data", func(t *testing.T) { checkData(t, db, dir) })
	t.Run("demo logins", func(t *testing.T) { checkDemoLogins(t, db, dir) })
	t.Run("demo case", func(t *testing.T) { checkDemoCase(t, db, dir) })
	t.Run("no overbooking", func(t *testing.T) { checkNoOverbooking(t, db, dir) })
	t.Run("run twice", func(t *testing.T) { checkRunTwice(t, db, dir) })
	t.Run("restore images", func(t *testing.T) { checkRestoreImages(t, db, dir) })
}

func checkData(t *testing.T, db *gorm.DB, dir string) {

	if got, want := count(t, db, &models.User{}), int64(11+400); got != want {
		t.Errorf("users = %d; want %d", got, want)
	}
	if got := count(t, db, &models.Restaurant{}); got != int64(len(restaurants)) {
		t.Errorf("restaurants = %d; want %d", got, len(restaurants))
	}

	// จำนวนรีวิวแต่ละดาวต้องตรงตารางใน seed (ดีไซน์อ้างตัวเลขพวกนี้)
	for _, s := range restaurants {
		var r models.Restaurant
		db.Where("name = ?", s.name).First(&r)
		for star := 5; star >= 1; star-- {
			var n int64
			db.Model(&models.Review{}).Where("restaurant_id = ? AND rating = ?", r.ID, star).Count(&n)
			if n != int64(s.stars[5-star]) {
				t.Errorf("%s %d ดาว = %d; want %d", s.slug, star, n, s.stars[5-star])
			}
		}
	}

	// รูปทุกรูปที่ร้านอ้างถึงต้องมีไฟล์จริง
	var urls []string
	db.Model(&models.RestaurantImage{}).Pluck("url", &urls)
	if len(urls) == 0 {
		t.Fatal("ไม่มีรูปร้าน")
	}
	for _, u := range urls {
		if _, err := os.Stat(filepath.Join(dir, strings.TrimPrefix(u, "/uploads/"))); err != nil {
			t.Errorf("ไม่มีไฟล์รูป %s", u)
		}
	}

	if got := count(t, db, &models.Booking{}); got == 0 {
		t.Error("ไม่มีการจอง")
	}
}

func checkDemoLogins(t *testing.T, db *gorm.DB, _ string) {
	for email, pass := range map[string]string{
		"usr1@email.com":          TestPassword,
		"usr2@email.com":          TestPassword,
		"nid@example.com":         Password,
		"reviewer001@example.com": Password,
	} {
		var u models.User
		if err := db.Where("email = ?", email).First(&u).Error; err != nil {
			t.Errorf("ไม่มีบัญชี %s", email)
			continue
		}
		if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(pass)) != nil {
			t.Errorf("%s: รหัสผ่าน %q ใช้ไม่ได้", email, pass)
		}
	}
}

func checkDemoCase(t *testing.T, db *gorm.DB, _ string) {
	// เคสเดโม: ครัวริมคลอง 10 ที่ พรุ่งนี้ 12:00–13:00 สมชาย 7 + อีกคน 3 = เต็มพอดี
	var shop models.Restaurant
	db.Where("name = ?", "ครัวริมคลอง").First(&shop)
	var somchai models.User
	db.Where("email = ?", "usr2@email.com").First(&somchai)

	tomorrow := time.Now().In(booking.Loc).AddDate(0, 0, 1)
	from, to := booking.At(tomorrow, 12*hm), booking.At(tomorrow, 13*hm)
	var rows []models.Booking
	db.Where("restaurant_id = ? AND status = ? AND start_at < ? AND end_at > ?", shop.ID, models.StatusConfirmed, to, from).Find(&rows)

	total, mine := 0, 0
	for _, b := range rows {
		total += b.PartySize
		if b.UserID == somchai.ID {
			mine += b.PartySize
		}
	}
	if shop.Seats != 10 || total != 10 || mine != 7 {
		t.Errorf("ที่นั่ง %d · จองรวม %d · ของสมชาย %d; want 10 · 10 · 7", shop.Seats, total, mine)
	}
}

func checkNoOverbooking(t *testing.T, db *gorm.DB, _ string) {
	// seed ใส่การจองที่ผ่านมาแล้วตรง ๆ (ไม่ผ่าน booking.Create) → ตรวจว่าทุกช่องไม่เกินที่นั่ง
	var shops []models.Restaurant
	db.Find(&shops)
	today := time.Now().In(booking.Loc)
	for i := range shops {
		for d := -31; d <= 7; d++ {
			slots, err := booking.Availability(db, &shops[i], today.AddDate(0, 0, d), 0, time.Now())
			if err != nil {
				t.Fatal(err)
			}
			for _, s := range slots {
				if s.Used > shops[i].Seats {
					t.Errorf("%s วันที่ %+d ช่อง %s: %d/%d", shops[i].Name, d, s.Start, s.Used, shops[i].Seats)
				}
			}
		}
	}
}

func checkRunTwice(t *testing.T, db *gorm.DB, dir string) {
	before := []int64{count(t, db, &models.User{}), count(t, db, &models.Booking{}), count(t, db, &models.Review{})}
	if err := Run(db, dir); err != nil {
		t.Fatal(err)
	}
	after := []int64{count(t, db, &models.User{}), count(t, db, &models.Booking{}), count(t, db, &models.Review{})}
	for i := range before {
		if before[i] != after[i] {
			t.Errorf("รันซ้ำแล้วข้อมูลเปลี่ยน: %v → %v", before, after)
			break
		}
	}
}

func checkRestoreImages(t *testing.T, db *gorm.DB, dir string) {
	// volume ของ Docker ถูกสร้างใหม่ แต่ DB ยังอยู่ → Run เขียนรูปคืนให้
	os.RemoveAll(dir)
	if err := Run(db, dir); err != nil {
		t.Fatal(err)
	}
	if entries, _ := os.ReadDir(dir); len(entries) == 0 {
		t.Error("รูปไม่ถูกเขียนคืน")
	}
}

func TestResetKeepsSecrets(t *testing.T) {
	db, dir := runSeed(t)
	key, err := database.JWTSecret(db)
	if err != nil {
		t.Fatal(err)
	}

	// ลำดับเดียวกับ main: Reset → Migrate → Run
	if err := Reset(db); err != nil {
		t.Fatal(err)
	}
	if db.Migrator().HasTable(&models.User{}) || db.Migrator().HasTable(&models.Booking{}) {
		t.Error("Reset ต้องลบตาราง")
	}
	if err := database.Migrate(db); err != nil {
		t.Fatal(err)
	}
	if err := Run(db, dir); err != nil {
		t.Fatal(err)
	}
	if count(t, db, &models.User{}) == 0 {
		t.Error("seed ใหม่หลัง reset ไม่ได้ข้อมูล")
	}
	// กุญแจ JWT อยู่รอด → login เดิมยังใช้ได้หลัง reset
	if again, _ := database.JWTSecret(db); string(again) != string(key) {
		t.Error("Reset ทำให้กุญแจ JWT เปลี่ยน")
	}
}

func TestNextHalfHour(t *testing.T) {
	at := func(h, m int) time.Time { return time.Date(2026, 9, 25, h, m, 0, 0, booking.Loc) }
	cases := map[time.Time]time.Time{
		at(10, 0):  at(10, 30),
		at(10, 1):  at(10, 30),
		at(10, 29): at(10, 30),
		at(10, 30): at(11, 0),
		at(23, 45): at(24, 0),
	}
	for in, want := range cases {
		if got := nextHalfHour(in); !got.Equal(want) {
			t.Errorf("nextHalfHour(%s) = %s; want %s", in.Format("15:04"), got.Format("15:04"), want.Format("15:04"))
		}
	}
}

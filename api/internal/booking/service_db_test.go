package booking

import (
	"errors"
	"math"
	"sync"
	"testing"

	"gorm.io/gorm"

	"toawang/internal/apperr"
	"toawang/internal/models"
	"toawang/internal/testdb"
)

// integration test: รันกับ Postgres จริง (ล็อกแถว FOR UPDATE / query ช่วงเวลาซ้อนกัน) · ไม่มี DB = skip

func mkUser(t *testing.T, db *gorm.DB, email string) uint {
	t.Helper()
	u := models.User{Name: email, Email: email, PasswordHash: "x"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	return u.ID
}

// mkShop ร้าน 11:00–22:00 · ยกเลิกล่วงหน้า 60 นาที
func mkShop(t *testing.T, db *gorm.DB, owner uint, seats int) *models.Restaurant {
	t.Helper()
	r := models.Restaurant{OwnerID: owner, Name: "ร้าน", Seats: seats, OpenMinute: 660, CloseMinute: 1320, CancelLeadMinutes: 60}
	if err := db.Create(&r).Error; err != nil {
		t.Fatal(err)
	}
	return &r
}

func in(start, end string, party int) Input {
	return Input{Date: "2026-09-25", Start: start, End: end, PartySize: party}
}

func mustCreate(t *testing.T, db *gorm.DB, shop, user uint, input Input) *models.Booking {
	t.Helper()
	b, err := Create(db, shop, user, input, testNow)
	if err != nil {
		t.Fatalf("Create %+v: %v", input, err)
	}
	return b
}

func TestCreateSavesSlot(t *testing.T) {
	db := testdb.Open(t, "booking")
	u := mkUser(t, db, "a@x.com")
	shop := mkShop(t, db, u, 10)

	b := mustCreate(t, db, shop.ID, u, in("18:00", "19:30", 4))
	var got models.Booking
	if err := db.First(&got, b.ID).Error; err != nil {
		t.Fatal(err)
	}
	if !got.StartAt.Equal(bkk(2026, 9, 25, 18, 0)) || !got.EndAt.Equal(bkk(2026, 9, 25, 19, 30)) ||
		got.PartySize != 4 || got.Status != models.StatusConfirmed || got.ServiceDate.Format(DateLayout) != "2026-09-25" {
		t.Errorf("booking = %+v", got)
	}
}

func TestCreateMissingRestaurant(t *testing.T) {
	db := testdb.Open(t, "booking")
	u := mkUser(t, db, "a@x.com")
	if _, err := Create(db, 999, u, in("18:00", "19:00", 1), testNow); errCode(err) != "NOT_FOUND" {
		t.Errorf("err = %v; want NOT_FOUND", err)
	}
}

func TestCheckSeatsPerSlot(t *testing.T) {
	// ตัวอย่างจากคอมเมนต์ CheckSeats: 12:00–12:30 (7) กับ 12:30–13:00 (7) ไม่ได้นั่งพร้อมกัน
	db := testdb.Open(t, "booking")
	u := mkUser(t, db, "a@x.com")
	shop := mkShop(t, db, u, 10)
	mustCreate(t, db, shop.ID, u, in("12:00", "12:30", 7))
	mustCreate(t, db, shop.ID, u, in("12:30", "13:00", 7))

	// ทุกช่องมี 7 → เพิ่มได้อีก 3 ตลอด 12:00–13:00 (ถ้ารวมทั้งช่วงจะได้ 14 แล้วปฏิเสธผิด ๆ)
	mustCreate(t, db, shop.ID, u, in("12:00", "13:00", 3))

	_, err := Create(db, shop.ID, u, in("11:30", "13:00", 1), testNow)
	if errCode(err) != "SEATS_EXCEEDED" {
		t.Fatalf("err = %v; want SEATS_EXCEEDED", err)
	}
	// details บอกช่องแรกที่เต็ม (11:30 ยังว่าง → 12:00)
	var e *apperr.Error
	errors.As(err, &e)
	want := SeatsExceededDetails{SlotStart: "12:00", SlotEnd: "12:30", Used: 10, Party: 1, Seats: 10}
	if e.Details != want {
		t.Errorf("details = %+v; want %+v", e.Details, want)
	}

	// ช่วงอื่นยังว่าง
	mustCreate(t, db, shop.ID, u, in("13:00", "14:00", 10))
}

func TestCheckSeatsHugePartyDoesNotOverflow(t *testing.T) {
	// คอมเมนต์ใน CheckSeats: used+party อาจล้น int แล้วติดลบ → ต้องไม่ผ่าน
	db := testdb.Open(t, "booking")
	u := mkUser(t, db, "a@x.com")
	shop := mkShop(t, db, u, 10)
	mustCreate(t, db, shop.ID, u, in("18:00", "19:00", 1))
	if _, err := Create(db, shop.ID, u, in("18:00", "19:00", math.MaxInt), testNow); errCode(err) != "SEATS_EXCEEDED" {
		t.Errorf("err = %v; want SEATS_EXCEEDED", err)
	}
}

func TestCancelledBookingsFreeSeats(t *testing.T) {
	db := testdb.Open(t, "booking")
	u := mkUser(t, db, "a@x.com")
	shop := mkShop(t, db, u, 4)
	b := mustCreate(t, db, shop.ID, u, in("18:00", "19:00", 4))
	if err := Cancel(db, b.ID, u, testNow); err != nil {
		t.Fatal(err)
	}
	mustCreate(t, db, shop.ID, u, in("18:00", "19:00", 4))
}

func TestUpdateExcludesOwnSeats(t *testing.T) {
	// ตัวอย่างจากคอมเมนต์ Update: ร้าน 10 ที่ · A จอง 7 · B จอง 3 → A แก้เป็น 8 ✕ · A แก้เป็น 5 ✓
	db := testdb.Open(t, "booking")
	a := mkUser(t, db, "a@x.com")
	bUser := mkUser(t, db, "b@x.com")
	shop := mkShop(t, db, a, 10)
	ab := mustCreate(t, db, shop.ID, a, in("18:00", "19:00", 7))
	mustCreate(t, db, shop.ID, bUser, in("18:00", "19:00", 3))

	if err := Update(db, ab.ID, a, in("18:00", "19:00", 8), testNow); errCode(err) != "SEATS_EXCEEDED" {
		t.Errorf("แก้เป็น 8: %v; want SEATS_EXCEEDED", err)
	}
	if err := Update(db, ab.ID, a, in("18:30", "20:00", 5), testNow); err != nil {
		t.Fatalf("แก้เป็น 5: %v", err)
	}
	var got models.Booking
	db.First(&got, ab.ID)
	if got.PartySize != 5 || !got.StartAt.Equal(bkk(2026, 9, 25, 18, 30)) || !got.EndAt.Equal(bkk(2026, 9, 25, 20, 0)) {
		t.Errorf("หลังแก้ = %+v", got)
	}
	// ข้อมูลใหม่ผิดกติกา → ไม่แก้
	if err := Update(db, ab.ID, a, in("18:15", "20:00", 5), testNow); errCode(err) != "INVALID_SLOT" {
		t.Errorf("err = %v; want INVALID_SLOT", err)
	}
}

func TestModifyRules(t *testing.T) {
	db := testdb.Open(t, "booking")
	owner := mkUser(t, db, "a@x.com")
	other := mkUser(t, db, "b@x.com")
	shop := mkShop(t, db, owner, 10)
	b := mustCreate(t, db, shop.ID, owner, in("18:00", "19:00", 2)) // ยกเลิกได้ถึง 17:00

	if err := Cancel(db, b.ID, other, testNow); errCode(err) != "FORBIDDEN" {
		t.Errorf("คนอื่นยกเลิก: %v; want FORBIDDEN", err)
	}
	if err := Update(db, b.ID, other, in("18:00", "19:00", 1), testNow); errCode(err) != "FORBIDDEN" {
		t.Errorf("คนอื่นแก้: %v; want FORBIDDEN", err)
	}
	if err := Cancel(db, 999, owner, testNow); errCode(err) != "NOT_FOUND" {
		t.Errorf("ไม่มีการจอง: %v; want NOT_FOUND", err)
	}
	late := bkk(2026, 9, 25, 17, 1)
	if err := Cancel(db, b.ID, owner, late); errCode(err) != "CANCEL_WINDOW_PASSED" {
		t.Errorf("เลยเส้นตาย: %v; want CANCEL_WINDOW_PASSED", err)
	}

	if err := Cancel(db, b.ID, owner, testNow); err != nil {
		t.Fatal(err)
	}
	var got models.Booking
	db.First(&got, b.ID)
	if got.Status != models.StatusCancelled || got.CancelledAt == nil || !got.CancelledAt.Equal(testNow) {
		t.Errorf("หลังยกเลิก = %+v", got)
	}
	if err := Cancel(db, b.ID, owner, testNow); errCode(err) != "BOOKING_CANCELLED" {
		t.Errorf("ยกเลิกซ้ำ: %v; want BOOKING_CANCELLED", err)
	}
	if err := Update(db, b.ID, owner, in("18:00", "19:00", 1), testNow); errCode(err) != "BOOKING_CANCELLED" {
		t.Errorf("แก้หลังยกเลิก: %v; want BOOKING_CANCELLED", err)
	}
}

func TestConcurrentCreateNeverOverbooks(t *testing.T) {
	// หัวใจของ LockRestaurant: ยิงพร้อมกัน 20 คำขอ แย่ง 5 ที่ → ต้องได้พอดี 5 ไม่เกิน
	db := testdb.Open(t, "booking")
	u := mkUser(t, db, "a@x.com")
	shop := mkShop(t, db, u, 5)

	const n = 20
	var wg sync.WaitGroup
	errs := make([]error, n)
	start := make(chan struct{})
	for i := range n {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			_, errs[i] = Create(db, shop.ID, u, in("18:00", "19:00", 1), testNow)
		}()
	}
	close(start)
	wg.Wait()

	ok, full := 0, 0
	for _, err := range errs {
		switch {
		case err == nil:
			ok++
		case errors.Is(err, ErrSeatsExceeded) || errCode(err) == "SEATS_EXCEEDED":
			full++
		default:
			t.Errorf("error ที่ไม่คาดคิด: %v", err)
		}
	}
	var seated int64
	db.Model(&models.Booking{}).Where("restaurant_id = ?", shop.ID).Select("COALESCE(SUM(party_size), 0)").Scan(&seated)
	if ok != 5 || full != n-5 || seated != 5 {
		t.Errorf("สำเร็จ %d · เต็ม %d · ที่นั่งใน DB %d; want 5 · %d · 5", ok, full, seated, n-5)
	}
}

func TestAvailability(t *testing.T) {
	db := testdb.Open(t, "booking")
	u := mkUser(t, db, "a@x.com")
	shop := mkShop(t, db, u, 10)
	b := mustCreate(t, db, shop.ID, u, in("12:00", "13:00", 4))
	mustCreate(t, db, shop.ID, u, in("12:30", "13:30", 2))
	c := mustCreate(t, db, shop.ID, u, in("20:00", "21:00", 5))
	if err := Cancel(db, c.ID, u, testNow); err != nil {
		t.Fatal(err)
	}

	now := bkk(2026, 9, 25, 12, 15) // ช่อง 11:00–12:00 ผ่านไปแล้ว · 12:00 กำลังเกิดขึ้น
	slots, err := Availability(db, shop, mustDate(t, "2026-09-25"), 0, now)
	if err != nil {
		t.Fatal(err)
	}
	if len(slots) != 22 { // 11:00–22:00 = 11 ชม. × 2
		t.Fatalf("จำนวนช่อง = %d; want 22", len(slots))
	}
	byStart := map[string]SlotUsage{}
	for _, s := range slots {
		byStart[s.Start] = s
	}
	checks := []SlotUsage{
		{Start: "11:00", Used: 0, Past: true},
		{Start: "11:30", Used: 0, Past: true},
		{Start: "12:00", Used: 4, Past: false},
		{Start: "12:30", Used: 6},
		{Start: "13:00", Used: 2},
		{Start: "13:30", Used: 0},
		{Start: "20:00", Used: 0}, // ยกเลิกแล้วไม่นับ
	}
	for _, want := range checks {
		if got := byStart[want.Start]; got != want {
			t.Errorf("ช่อง %s = %+v; want %+v", want.Start, got, want)
		}
	}

	// excludeID = ตอนแก้ไขการจอง b → ไม่นับที่นั่งของ b
	slots, _ = Availability(db, shop, mustDate(t, "2026-09-25"), b.ID, now)
	for _, s := range slots {
		if s.Start == "12:30" && s.Used != 2 {
			t.Errorf("exclude: ช่อง 12:30 = %d; want 2", s.Used)
		}
	}
}

func TestAvailabilityCrossMidnight(t *testing.T) {
	db := testdb.Open(t, "booking")
	u := mkUser(t, db, "a@x.com")
	shop := models.Restaurant{OwnerID: u, Name: "ดึก", Seats: 10, OpenMinute: 1080, CloseMinute: 120, CancelLeadMinutes: 30}
	db.Create(&shop)
	mustCreate(t, db, shop.ID, u, in("00:30", "01:30", 3))

	slots, err := Availability(db, &shop, mustDate(t, "2026-09-25"), 0, testNow)
	if err != nil {
		t.Fatal(err)
	}
	if len(slots) != 16 || slots[0].Start != "18:00" || slots[len(slots)-1].Start != "01:30" {
		t.Fatalf("slots = %+v", slots)
	}
	if s := slots[13]; s.Start != "00:30" || s.Used != 3 { // 18:00 + 13 ช่อง
		t.Errorf("ช่อง 00:30 = %+v", s)
	}
	// การจองหลังเที่ยงคืนของรอบวันที่ 25 ต้องไม่โผล่ในรอบวันที่ 26
	slots, _ = Availability(db, &shop, mustDate(t, "2026-09-26"), 0, testNow)
	for _, s := range slots {
		if s.Used != 0 {
			t.Errorf("รอบวันที่ 26 ช่อง %s มี %d คน", s.Start, s.Used)
		}
	}
}

func TestUpcomingScopeMatchesUpcoming(t *testing.T) {
	db := testdb.Open(t, "booking")
	u := mkUser(t, db, "a@x.com")
	shop := mkShop(t, db, u, 10)
	mustCreate(t, db, shop.ID, u, in("11:00", "12:00", 1))
	mustCreate(t, db, shop.ID, u, in("12:00", "13:00", 1))
	c := mustCreate(t, db, shop.ID, u, in("18:00", "19:00", 1))
	Cancel(db, c.ID, u, testNow)

	now := bkk(2026, 9, 25, 12, 0) // อันแรกจบพอดี · อันที่สองกำลังเริ่ม · อันที่สามยกเลิก
	var all []models.Booking
	db.Find(&all)
	want := 0
	for i := range all {
		if Upcoming(&all[i], now) {
			want++
		}
	}
	var got int64
	db.Model(&models.Booking{}).Scopes(UpcomingScope(now)).Count(&got)
	if got != int64(want) || want != 1 {
		t.Errorf("UpcomingScope = %d · Upcoming = %d; want 1", got, want)
	}
}

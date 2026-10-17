package booking

import (
	"testing"
	"time"

	"toawang/internal/models"
)

func TestCancelDeadline(t *testing.T) {
	b := &models.Booking{StartAt: bkk(2026, 9, 25, 18, 0)}
	r := &models.Restaurant{CancelLeadMinutes: 90}
	if got, want := CancelDeadline(b, r), bkk(2026, 9, 25, 16, 30); !got.Equal(want) {
		t.Errorf("CancelDeadline = %v; want %v", got, want)
	}
}

func TestCanModify(t *testing.T) {
	r := &models.Restaurant{CancelLeadMinutes: 60}
	start := bkk(2026, 9, 25, 18, 0) // ยกเลิกได้ถึง 17:00
	confirmed := &models.Booking{StartAt: start, Status: models.StatusConfirmed}
	cancelled := &models.Booking{StartAt: start, Status: models.StatusCancelled}

	cases := []struct {
		name string
		b    *models.Booking
		now  time.Time
		want error
	}{
		{"ก่อนเส้นตาย", confirmed, bkk(2026, 9, 25, 16, 59), nil},
		{"ตรงเส้นตายพอดี", confirmed, bkk(2026, 9, 25, 17, 0), nil},
		{"เลยเส้นตาย", confirmed, bkk(2026, 9, 25, 17, 0).Add(time.Second), ErrWindowPassed},
		{"ยกเลิกไปแล้ว", cancelled, bkk(2026, 9, 25, 10, 0), ErrBookingCancelled},
		{"ยกเลิกไปแล้ว และเลยเส้นตาย", cancelled, bkk(2026, 9, 25, 19, 0), ErrBookingCancelled},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := CanModify(c.b, r, c.now); got != c.want {
				t.Errorf("CanModify = %v; want %v", got, c.want)
			}
		})
	}
}

func TestUpcoming(t *testing.T) {
	now := bkk(2026, 9, 25, 18, 30)
	b := func(status string, end time.Time) *models.Booking {
		return &models.Booking{Status: status, StartAt: end.Add(-time.Hour), EndAt: end}
	}
	cases := []struct {
		name string
		b    *models.Booking
		want bool
	}{
		{"ยังไม่เริ่ม", b(models.StatusConfirmed, bkk(2026, 9, 25, 21, 0)), true},
		{"กำลังนั่งกินอยู่", b(models.StatusConfirmed, bkk(2026, 9, 25, 19, 0)), true},
		{"จบตอนนี้พอดี", b(models.StatusConfirmed, now), false},
		{"จบไปแล้ว", b(models.StatusConfirmed, bkk(2026, 9, 25, 18, 0)), false},
		{"ยกเลิกแล้ว", b(models.StatusCancelled, bkk(2026, 9, 25, 21, 0)), false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := Upcoming(c.b, now); got != c.want {
				t.Errorf("Upcoming = %v; want %v", got, c.want)
			}
		})
	}
}

func TestUsedIn(t *testing.T) {
	// ตัวอย่างจากคอมเมนต์ CheckSeats: 12:00–12:30 (7 คน) กับ 12:30–13:00 (7 คน) ไม่ซ้อนกันเอง
	bookings := []models.Booking{
		{StartAt: bkk(2026, 9, 25, 12, 0), EndAt: bkk(2026, 9, 25, 12, 30), PartySize: 7},
		{StartAt: bkk(2026, 9, 25, 12, 30), EndAt: bkk(2026, 9, 25, 13, 0), PartySize: 7},
		{StartAt: bkk(2026, 9, 25, 11, 30), EndAt: bkk(2026, 9, 25, 13, 30), PartySize: 2},
	}
	cases := []struct {
		from, to time.Time
		want     int
	}{
		{bkk(2026, 9, 25, 12, 0), bkk(2026, 9, 25, 12, 30), 9},
		{bkk(2026, 9, 25, 12, 30), bkk(2026, 9, 25, 13, 0), 9},
		{bkk(2026, 9, 25, 13, 0), bkk(2026, 9, 25, 13, 30), 2},
		{bkk(2026, 9, 25, 13, 30), bkk(2026, 9, 25, 14, 0), 0}, // จบ 13:30 พอดี = ไม่คร่อม
		{bkk(2026, 9, 25, 11, 0), bkk(2026, 9, 25, 11, 30), 0}, // เริ่ม 11:30 พอดี = ไม่คร่อม
	}
	for _, c := range cases {
		if got := usedIn(bookings, c.from, c.to); got != c.want {
			t.Errorf("usedIn(%s–%s) = %d; want %d", Clock(c.from), Clock(c.to), got, c.want)
		}
	}
	if got := usedIn(nil, cases[0].from, cases[0].to); got != 0 {
		t.Errorf("usedIn(nil) = %d", got)
	}
}

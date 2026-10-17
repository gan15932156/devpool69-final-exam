package booking

import (
	"testing"
	"time"
)

// mustDate "2026-09-25" → เที่ยงคืนวันนั้นเวลาไทย
func mustDate(t *testing.T, s string) time.Time {
	t.Helper()
	d, err := ParseDate(s)
	if err != nil {
		t.Fatalf("ParseDate(%q): %v", s, err)
	}
	return d
}

// bkk สร้างเวลาไทยตรง ๆ ไว้เทียบผล
func bkk(y int, m time.Month, d, hh, mm int) time.Time {
	return time.Date(y, m, d, hh, mm, 0, 0, Loc)
}

func TestParseHHMM(t *testing.T) {
	ok := map[string]int{
		"00:00": 0,
		"00:30": 30,
		"11:00": 660,
		"18:30": 1110,
		"23:59": 1439,
	}
	for in, want := range ok {
		got, err := ParseHHMM(in)
		if err != nil || got != want {
			t.Errorf("ParseHHMM(%q) = %d, %v; want %d", in, got, err, want)
		}
	}

	bad := []string{"", "1:00", "01:0", "24:00", "12:60", "12-30", "ab:cd", "+1:00", " 1:00", "12:300", "１２:００"}
	for _, in := range bad {
		if _, err := ParseHHMM(in); err == nil {
			t.Errorf("ParseHHMM(%q) ควร error", in)
		}
	}
}

func TestFormatHHMM(t *testing.T) {
	cases := map[int]string{
		0:    "00:00",
		660:  "11:00",
		1110: "18:30",
		1439: "23:59",
		1440: "00:00", // เกิน 24 ชม. วนกลับ
		1500: "01:00",
		-30:  "23:30", // ติดลบก็วนกลับ
	}
	for in, want := range cases {
		if got := FormatHHMM(in); got != want {
			t.Errorf("FormatHHMM(%d) = %q; want %q", in, got, want)
		}
	}
}

func TestParseFormatRoundTrip(t *testing.T) {
	for m := 0; m < 1440; m += 30 {
		got, err := ParseHHMM(FormatHHMM(m))
		if err != nil || got != m {
			t.Fatalf("round trip %d → %q → %d, %v", m, FormatHHMM(m), got, err)
		}
	}
}

func TestOnHalfHour(t *testing.T) {
	for _, m := range []int{0, 30, 660, 1410} {
		if !OnHalfHour(m) {
			t.Errorf("OnHalfHour(%d) = false", m)
		}
	}
	for _, m := range []int{1, 15, 45, 659} {
		if OnHalfHour(m) {
			t.Errorf("OnHalfHour(%d) = true", m)
		}
	}
}

func TestCrossesMidnight(t *testing.T) {
	cases := []struct {
		open, close int
		want        bool
	}{
		{660, 1320, false}, // 11:00–22:00
		{1080, 120, true},  // 18:00–02:00
		{1080, 0, true},    // 18:00–00:00 ปิดตอนเที่ยงคืนพอดี = ข้ามไปวันถัดไป
		{600, 600, true},   // เท่ากัน (validate ไม่รับอยู่แล้ว)
	}
	for _, c := range cases {
		if got := CrossesMidnight(c.open, c.close); got != c.want {
			t.Errorf("CrossesMidnight(%d, %d) = %v; want %v", c.open, c.close, got, c.want)
		}
	}
}

func TestParseDate(t *testing.T) {
	d := mustDate(t, "2026-09-25")
	if want := bkk(2026, 9, 25, 0, 0); !d.Equal(want) || d.Location() != Loc {
		t.Errorf("ParseDate = %v; want %v (Asia/Bangkok)", d, want)
	}
	for _, bad := range []string{"", "2026-9-25", "25-09-2026", "2026-02-30", "2026-09-25T00:00"} {
		if _, err := ParseDate(bad); err == nil {
			t.Errorf("ParseDate(%q) ควร error", bad)
		}
	}
}

func TestAt(t *testing.T) {
	d := mustDate(t, "2026-09-25")
	if got, want := At(d, 1110), bkk(2026, 9, 25, 18, 30); !got.Equal(want) {
		t.Errorf("At = %v; want %v", got, want)
	}
	// เวลาที่ส่งมาเป็น UTC ก็ยังยึด "วันที่" ของค่านั้น แล้วตีเป็นเวลาไทย
	utc := time.Date(2026, 9, 25, 0, 0, 0, 0, time.UTC)
	if got, want := At(utc, 60), bkk(2026, 9, 25, 1, 0); !got.Equal(want) {
		t.Errorf("At(UTC) = %v; want %v", got, want)
	}
}

func TestServiceWindow(t *testing.T) {
	d := mustDate(t, "2026-09-25")

	start, end := ServiceWindow(d, 660, 1320) // 11:00–22:00
	if !start.Equal(bkk(2026, 9, 25, 11, 0)) || !end.Equal(bkk(2026, 9, 25, 22, 0)) {
		t.Errorf("ร้านปกติ: %v – %v", start, end)
	}

	start, end = ServiceWindow(d, 1080, 120) // 18:00–02:00
	if !start.Equal(bkk(2026, 9, 25, 18, 0)) || !end.Equal(bkk(2026, 9, 26, 2, 0)) {
		t.Errorf("ร้านข้ามเที่ยงคืน: %v – %v", start, end)
	}

	// สิ้นเดือน/สิ้นปี → วันถัดไปต้องข้ามเดือน/ปีให้ถูก
	start, end = ServiceWindow(mustDate(t, "2026-12-31"), 1080, 120)
	if !start.Equal(bkk(2026, 12, 31, 18, 0)) || !end.Equal(bkk(2027, 1, 1, 2, 0)) {
		t.Errorf("ข้ามปี: %v – %v", start, end)
	}
}

func TestResolve(t *testing.T) {
	d := mustDate(t, "2026-09-25")
	cases := []struct {
		name               string
		minutes, open, cls int
		want               time.Time
	}{
		{"ร้านปกติ", 720, 660, 1320, bkk(2026, 9, 25, 12, 0)},
		{"ข้ามเที่ยงคืน ก่อนเที่ยงคืน", 1260, 1080, 120, bkk(2026, 9, 25, 21, 0)},
		{"ข้ามเที่ยงคืน หลังเที่ยงคืน", 60, 1080, 120, bkk(2026, 9, 26, 1, 0)},
		{"ข้ามเที่ยงคืน = เวลาปิดพอดี", 120, 1080, 120, bkk(2026, 9, 26, 2, 0)},
		{"ข้ามเที่ยงคืน 00:00", 0, 1080, 120, bkk(2026, 9, 26, 0, 0)},
		{"ข้ามเที่ยงคืน นอกเวลา (ก่อนเปิด) อยู่วันเดิม", 1050, 1080, 120, bkk(2026, 9, 25, 17, 30)},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := Resolve(d, c.minutes, c.open, c.cls); !got.Equal(c.want) {
				t.Errorf("Resolve = %v; want %v", got, c.want)
			}
		})
	}
}

func TestDateOnly(t *testing.T) {
	// เที่ยงคืนเวลาไทย = 17:00 UTC ของวันก่อน → ต้องได้เที่ยงคืน UTC ของ "วันเดียวกัน" ตามเวลาไทย
	got := DateOnly(mustDate(t, "2026-09-25"))
	want := time.Date(2026, 9, 25, 0, 0, 0, 0, time.UTC)
	if !got.Equal(want) || got.Location() != time.UTC {
		t.Errorf("DateOnly = %v; want %v", got, want)
	}
}

func TestClock(t *testing.T) {
	// 11:30 UTC = 18:30 เวลาไทย
	if got := Clock(time.Date(2026, 9, 25, 11, 30, 0, 0, time.UTC)); got != "18:30" {
		t.Errorf("Clock = %q; want 18:30", got)
	}
}

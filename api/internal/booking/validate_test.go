package booking

import (
	"errors"
	"testing"
	"time"

	"toawang/internal/apperr"
	"toawang/internal/models"
)

// ร้านตัวอย่าง: ปกติ 11:00–22:00 · ข้ามเที่ยงคืน 18:00–02:00
var (
	dayShop   = &models.Restaurant{ID: 1, Seats: 10, OpenMinute: 660, CloseMinute: 1320, CancelLeadMinutes: 60}
	nightShop = &models.Restaurant{ID: 2, Seats: 10, OpenMinute: 1080, CloseMinute: 120, CancelLeadMinutes: 60}
)

// testNow = 2026-09-25 10:00 เวลาไทย
var testNow = time.Date(2026, 9, 25, 10, 0, 0, 0, Loc)

// errCode ดึง code ของ apperr.Error ("" = ไม่ใช่ apperr)
func errCode(err error) string {
	var e *apperr.Error
	if errors.As(err, &e) {
		return e.Code
	}
	return ""
}

func TestValidateOK(t *testing.T) {
	slot, err := Validate(dayShop, Input{Date: "2026-09-25", Start: "18:00", End: "19:30", PartySize: 4}, testNow)
	if err != nil {
		t.Fatalf("Validate: %v", err)
	}
	if !slot.StartAt.Equal(bkk(2026, 9, 25, 18, 0)) || !slot.EndAt.Equal(bkk(2026, 9, 25, 19, 30)) {
		t.Errorf("slot = %v – %v", slot.StartAt, slot.EndAt)
	}
	if want := time.Date(2026, 9, 25, 0, 0, 0, 0, time.UTC); !slot.ServiceDate.Equal(want) {
		t.Errorf("ServiceDate = %v; want %v", slot.ServiceDate, want)
	}
}

func TestValidateCrossMidnight(t *testing.T) {
	// รอบวันที่ 25 จอง 23:00–01:30 → จบตอน 26 01:30 แต่ ServiceDate ยังเป็นวันที่ 25
	slot, err := Validate(nightShop, Input{Date: "2026-09-25", Start: "23:00", End: "01:30", PartySize: 2}, testNow)
	if err != nil {
		t.Fatalf("Validate: %v", err)
	}
	if !slot.StartAt.Equal(bkk(2026, 9, 25, 23, 0)) || !slot.EndAt.Equal(bkk(2026, 9, 26, 1, 30)) {
		t.Errorf("slot = %v – %v", slot.StartAt, slot.EndAt)
	}
	if want := time.Date(2026, 9, 25, 0, 0, 0, 0, time.UTC); !slot.ServiceDate.Equal(want) {
		t.Errorf("ServiceDate = %v; want %v", slot.ServiceDate, want)
	}

	// จองจนถึงเวลาปิดพอดีได้
	if _, err := Validate(nightShop, Input{Date: "2026-09-25", Start: "01:00", End: "02:00", PartySize: 1}, testNow); err != nil {
		t.Errorf("จองถึงเวลาปิดพอดี: %v", err)
	}
}

func TestValidateErrors(t *testing.T) {
	cases := []struct {
		name string
		shop *models.Restaurant
		in   Input
		now  time.Time
		code string
	}{
		{"วันที่ผิดรูปแบบ", dayShop, Input{Date: "25/09/2026", Start: "18:00", End: "19:00", PartySize: 1}, testNow, "VALIDATION"},
		{"เวลาเริ่มผิดรูปแบบ", dayShop, Input{Date: "2026-09-25", Start: "6pm", End: "19:00", PartySize: 1}, testNow, "VALIDATION"},
		{"เวลาสิ้นสุดผิดรูปแบบ", dayShop, Input{Date: "2026-09-25", Start: "18:00", End: "", PartySize: 1}, testNow, "VALIDATION"},
		{"ไม่ลง :00/:30", dayShop, Input{Date: "2026-09-25", Start: "18:15", End: "19:00", PartySize: 1}, testNow, "INVALID_SLOT"},
		{"สิ้นสุด = เริ่ม", dayShop, Input{Date: "2026-09-25", Start: "18:00", End: "18:00", PartySize: 1}, testNow, "INVALID_RANGE"},
		{"สิ้นสุดก่อนเริ่ม", dayShop, Input{Date: "2026-09-25", Start: "19:00", End: "18:00", PartySize: 1}, testNow, "INVALID_RANGE"},
		{"ก่อนร้านเปิด", dayShop, Input{Date: "2026-09-25", Start: "10:30", End: "12:00", PartySize: 1}, testNow, "OUTSIDE_HOURS"},
		{"เลยเวลาปิด", dayShop, Input{Date: "2026-09-25", Start: "21:30", End: "22:30", PartySize: 1}, testNow, "OUTSIDE_HOURS"},
		// 02:30 เลยเวลาปิด → Resolve ไม่ย้ายไปวันถัดไป (= 25 02:30) จึงอยู่ก่อนเวลาเริ่ม (26 01:30) → ตกข้อ 3 ก่อนข้อ 4
		{"ข้ามเที่ยงคืน เลยเวลาปิด", nightShop, Input{Date: "2026-09-25", Start: "01:30", End: "02:30", PartySize: 1}, testNow, "INVALID_RANGE"},
		{"ข้ามเที่ยงคืน เริ่มก่อนเปิด จบหลังเที่ยงคืน", nightShop, Input{Date: "2026-09-25", Start: "17:00", End: "01:00", PartySize: 1}, testNow, "OUTSIDE_HOURS"},
		{"ข้ามเที่ยงคืน ก่อนเปิด", nightShop, Input{Date: "2026-09-25", Start: "17:30", End: "19:00", PartySize: 1}, testNow, "OUTSIDE_HOURS"},
		{"เวลาเริ่มผ่านไปแล้ว", dayShop, Input{Date: "2026-09-25", Start: "11:00", End: "12:00", PartySize: 1}, bkk(2026, 9, 25, 11, 0), "IN_PAST"},
		{"วันที่ผ่านไปแล้ว", dayShop, Input{Date: "2026-09-24", Start: "18:00", End: "19:00", PartySize: 1}, testNow, "IN_PAST"},
		{"เกิน 60 วัน", dayShop, Input{Date: "2026-11-25", Start: "18:00", End: "19:00", PartySize: 1}, testNow, "TOO_FAR_AHEAD"},
		{"ไม่มีคน", dayShop, Input{Date: "2026-09-25", Start: "18:00", End: "19:00", PartySize: 0}, testNow, "VALIDATION"},
		{"คนติดลบ", dayShop, Input{Date: "2026-09-25", Start: "18:00", End: "19:00", PartySize: -3}, testNow, "VALIDATION"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := Validate(c.shop, c.in, c.now)
			if got := errCode(err); got != c.code {
				t.Errorf("code = %q (err %v); want %q", got, err, c.code)
			}
		})
	}
}

func TestValidateMaxDaysAhead(t *testing.T) {
	// วันนี้ 25 ก.ย. + 60 วัน = 24 พ.ย. → วันที่ 24 ได้ · วันที่ 25 ไม่ได้
	last := testNow.AddDate(0, 0, MaxDaysAhead).Format(DateLayout)
	over := testNow.AddDate(0, 0, MaxDaysAhead+1).Format(DateLayout)
	if _, err := Validate(dayShop, Input{Date: last, Start: "18:00", End: "19:00", PartySize: 1}, testNow); err != nil {
		t.Errorf("วันที่ %s (ครบ %d วันพอดี): %v", last, MaxDaysAhead, err)
	}
	_, err := Validate(dayShop, Input{Date: over, Start: "18:00", End: "19:00", PartySize: 1}, testNow)
	if errCode(err) != "TOO_FAR_AHEAD" {
		t.Errorf("วันที่ %s: %v; want TOO_FAR_AHEAD", over, err)
	}

	// "วันนี้" ต้องคิดตามเวลาไทย: 24 ก.ย. 20:00 UTC = 25 ก.ย. 03:00 เวลาไทย
	nowUTC := time.Date(2026, 9, 24, 20, 0, 0, 0, time.UTC)
	if _, err := Validate(dayShop, Input{Date: last, Start: "18:00", End: "19:00", PartySize: 1}, nowUTC); err != nil {
		t.Errorf("now เป็น UTC: %v", err)
	}
}

func TestValidateOutsideHoursDetails(t *testing.T) {
	_, err := Validate(nightShop, Input{Date: "2026-09-25", Start: "17:00", End: "19:00", PartySize: 1}, testNow)
	var e *apperr.Error
	if !errors.As(err, &e) {
		t.Fatalf("err = %v", err)
	}
	d, ok := e.Details.(map[string]string)
	if !ok || d["open"] != "18:00" || d["close"] != "02:00" {
		t.Errorf("details = %#v", e.Details)
	}
	// WithDetails ต้องไม่แก้ตัวแปรกลาง
	if ErrOutsideHours.Details != nil {
		t.Errorf("ErrOutsideHours ถูกแก้: %#v", ErrOutsideHours.Details)
	}
}

func TestParseDateParam(t *testing.T) {
	if _, err := ParseDateParam("2026-09-25"); err != nil {
		t.Errorf("ParseDateParam: %v", err)
	}
	_, err := ParseDateParam("tomorrow")
	var e *apperr.Error
	if !errors.As(err, &e) || e.Code != "VALIDATION" {
		t.Fatalf("err = %v", err)
	}
	if d, _ := e.Details.(map[string]string); d["date"] == "" {
		t.Errorf("details ต้องบอกช่อง date: %#v", e.Details)
	}
}

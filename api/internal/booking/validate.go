package booking

import (
	"net/http"
	"time"

	"toawang/internal/apperr"
	"toawang/internal/models"
)

// Input = สิ่งที่ลูกค้ากรอก 3 อย่าง: จำนวนคน · วันที่ · เวลาเริ่ม–สิ้นสุด
// { "date": "2026-09-25", "start": "18:00", "end": "01:30", "partySize": 4 }
type Input struct {
	Date      string `json:"date"`
	Start     string `json:"start"`
	End       string `json:"end"`
	PartySize int    `json:"partySize"`
}

// Slot = Input ที่แปลงเป็นเวลาจริงแล้ว
type Slot struct {
	ServiceDate time.Time // รอบของวันไหน (เก็บลงคอลัมน์ date)
	StartAt     time.Time
	EndAt       time.Time
}

// error แต่ละข้อมี code ต่างกัน → หน้าเว็บรู้ว่าผิดเพราะอะไร
var (
	ErrInvalidSlot  = apperr.New(http.StatusBadRequest, "INVALID_SLOT", "เวลาต้องลงที่ :00 หรือ :30")
	ErrInvalidRange = apperr.New(http.StatusBadRequest, "INVALID_RANGE", "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม")
	ErrOutsideHours = apperr.New(http.StatusBadRequest, "OUTSIDE_HOURS", "อยู่นอกเวลาเปิดร้าน")
	ErrInPast       = apperr.New(http.StatusBadRequest, "IN_PAST", "เวลาเริ่มผ่านไปแล้ว")
)

// Validate ตรวจกติกาที่ไม่ต้องดูการจองของคนอื่น ตามลำดับ (เจอข้อแรกที่ผิดก็หยุด)
//  1. รูปแบบวันที่/เวลา  2. ลง :00/:30  3. สิ้นสุด > เริ่ม  4. อยู่ในเวลาเปิด  5. ยังไม่ผ่านไป  6. จำนวนคน ≥ 1
//
// ข้อ "ที่นั่งพอไหม" ตรวจแยกใน CheckSeats เพราะต้องทำใน transaction
func Validate(r *models.Restaurant, in Input, now time.Time) (Slot, error) {
	date, err := ParseDateParam(in.Date)
	if err != nil {
		return Slot{}, err
	}
	start, errStart := ParseHHMM(in.Start)
	end, errEnd := ParseHHMM(in.End)
	if errStart != nil || errEnd != nil {
		return Slot{}, apperr.Validation(map[string]string{"start": "รูปแบบเวลาต้องเป็น HH:MM"})
	}

	if !OnHalfHour(start) || !OnHalfHour(end) {
		return Slot{}, ErrInvalidSlot
	}

	startAt := Resolve(date, start, r.OpenMinute, r.CloseMinute)
	endAt := Resolve(date, end, r.OpenMinute, r.CloseMinute)
	if !endAt.After(startAt) {
		return Slot{}, ErrInvalidRange
	}

	windowStart, windowEnd := ServiceWindow(date, r.OpenMinute, r.CloseMinute)
	if startAt.Before(windowStart) || endAt.After(windowEnd) {
		return Slot{}, ErrOutsideHours.WithDetails(map[string]string{
			"open":  FormatHHMM(r.OpenMinute),
			"close": FormatHHMM(r.CloseMinute),
		})
	}

	if !startAt.After(now) {
		return Slot{}, ErrInPast
	}

	if in.PartySize < 1 {
		return Slot{}, apperr.Validation(map[string]string{"partySize": "ต้องมีอย่างน้อย 1 คน"})
	}

	return Slot{ServiceDate: DateOnly(date), StartAt: startAt, EndAt: endAt}, nil
}

// ParseDateParam = ParseDate ที่ตอบ error เป็น VALIDATION ของช่อง date · ใช้กับวันที่ที่รับมาจาก request ทุกที่
func ParseDateParam(s string) (time.Time, error) {
	date, err := ParseDate(s)
	if err != nil {
		return time.Time{}, apperr.Validation(map[string]string{"date": "รูปแบบวันที่ต้องเป็น YYYY-MM-DD"})
	}
	return date, nil
}

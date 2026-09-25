package booking

import (
	"errors"
	"fmt"
	"time"
	_ "time/tzdata" // ฝังฐานข้อมูล timezone ไว้ในโปรแกรม → LoadLocation ใช้ได้ทุกเครื่อง
)

// เวลาในแต่ละวันเก็บเป็น "นาทีนับจากเที่ยงคืน" เช่น 11:00 = 660, 18:30 = 1110
// กติกาการจองทั้งหมดคิดเป็นเวลาไทย

// Loc = เขตเวลาไทย (ไม่มี daylight saving → บวก/ลบนาทีได้ตรง ๆ)
var Loc = mustLoad("Asia/Bangkok")

func mustLoad(name string) *time.Location {
	loc, err := time.LoadLocation(name)
	if err != nil {
		panic(err)
	}
	return loc
}

var errBadTime = errors.New("รูปแบบเวลาต้องเป็น HH:MM")

// ParseHHMM แปลง "18:30" → 1110 · ต้องเป็นตัวเลข 2 หลัก : 2 หลัก เท่านั้น
func ParseHHMM(s string) (int, error) {
	if len(s) != 5 || s[2] != ':' {
		return 0, errBadTime
	}
	for _, i := range []int{0, 1, 3, 4} {
		if s[i] < '0' || s[i] > '9' {
			return 0, errBadTime
		}
	}
	h := int(s[0]-'0')*10 + int(s[1]-'0')
	m := int(s[3]-'0')*10 + int(s[4]-'0')
	if h > 23 || m > 59 {
		return 0, errBadTime
	}
	return h*60 + m, nil
}

// FormatHHMM แปลง 1110 → "18:30" (เกิน 24 ชม. จะวนกลับ เช่น 1500 → "01:00")
func FormatHHMM(minutes int) string {
	minutes = ((minutes % 1440) + 1440) % 1440
	return fmt.Sprintf("%02d:%02d", minutes/60, minutes%60)
}

// OnHalfHour — เวลาต้องลงที่ :00 หรือ :30 เท่านั้น
func OnHalfHour(minutes int) bool {
	return minutes%30 == 0
}

// CrossesMidnight — เวลาปิด <= เวลาเปิด แปลว่าปิดหลังเที่ยงคืน (เช่น 18:00–02:00)
func CrossesMidnight(open, close int) bool {
	return close <= open
}

// ParseDate "2026-09-25" → เที่ยงคืนวันนั้น (เวลาไทย)
func ParseDate(s string) (time.Time, error) {
	return time.ParseInLocation(DateLayout, s, Loc)
}

// At วันที่ + นาทีนับจากเที่ยงคืน → เวลาจริง (เวลาไทย)
func At(date time.Time, minutes int) time.Time {
	y, m, d := date.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, Loc).Add(time.Duration(minutes) * time.Minute)
}

// ServiceWindow ช่วงเวลาที่ร้านเปิดของ "รอบ" วันที่ date
// ร้าน 18:00–02:00 รอบวันที่ 25 = 25 18:00 ถึง 26 02:00
func ServiceWindow(date time.Time, open, close int) (start, end time.Time) {
	start = At(date, open)
	if CrossesMidnight(open, close) {
		return start, At(date.AddDate(0, 0, 1), close)
	}
	return start, At(date, close)
}

// Resolve แปลง "เวลาบนหน้าปัด" ของรอบวันที่ date เป็นเวลาจริง
// ร้านข้ามเที่ยงคืน + เวลาอยู่ช่วงหลังเที่ยงคืน (00:00 ถึงเวลาปิด) → เป็นของวันถัดไป
// เช่น ร้าน 18:00–02:00 รอบวันที่ 25: "01:00" → 26 01:00 · "17:30" → 25 17:30 (นอกเวลา ถูกตรวจทีหลัง)
func Resolve(date time.Time, minutes, open, close int) time.Time {
	if CrossesMidnight(open, close) && minutes <= close {
		return At(date.AddDate(0, 0, 1), minutes)
	}
	return At(date, minutes)
}

// DateOnly — ค่าที่จะเก็บลงคอลัมน์ type:date ต้องเป็นเที่ยงคืน UTC
// ถ้าส่งเที่ยงคืนเวลาไทย (= 17:00 UTC ของวันก่อน) Postgres จะตัดเหลือ "วันก่อนหน้า"
func DateOnly(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

// Clock เวลาจริง → "HH:MM" เวลาไทย
func Clock(t time.Time) string {
	return t.In(Loc).Format("15:04")
}

// DateLayout รูปแบบวันที่ที่ API รับ/ส่ง: "2026-09-25"
const DateLayout = "2006-01-02"

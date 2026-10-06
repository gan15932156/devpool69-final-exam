package booking

import (
	"fmt"
	"net/http"

	"toawang/internal/apperr"
)

// MaxDaysAhead จองล่วงหน้าได้ไกลสุดกี่วัน (เทียบวันที่ของรอบกับวันนี้ตามเวลาไทย)
// ไม่จำกัด = บัญชีเดียวจองที่นั่งทุกร้านล่วงหน้าไปเป็นปีได้
const MaxDaysAhead = 60

var ErrTooFarAhead = apperr.New(http.StatusBadRequest, "TOO_FAR_AHEAD", fmt.Sprintf("จองล่วงหน้าได้ไม่เกิน %d วัน", MaxDaysAhead))

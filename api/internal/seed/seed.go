package seed

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"math/rand/v2"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"toawang/internal/booking"
	"toawang/internal/models"
)

// Password ของบัญชีทดสอบทุกบัญชี (ยกเว้น 2 บัญชี present ใช้ TestPassword)
const Password = "toawang123"

// TestPassword ของบัญชี present: usr1@email.com (มะลิ) · usr2@email.com (สมชาย)
const TestPassword = "123456"

// รูปร้านฝังไว้ในไฟล์โปรแกรม (ใช้ได้ทั้งตอน go run และใน Docker)
// อยากใช้รูปจริง: วางไฟล์ images/<slug>-1.jpg, -2.jpg ... ทับของเดิม (jpg/png/webp)
//
//go:embed images
var imagesFS embed.FS

// presenterReview = รีวิวที่บัญชีสำหรับ present เขียนไว้แล้ว (นับรวมอยู่ในจำนวนรีวิวของร้าน)
type presenterReview struct {
	who     string
	star    int
	comment string
}

type restaurantSeed struct {
	slug, name, cuisine, description string
	owner                            string // key ใน map ผู้ใช้
	seats, open, close, lead         int
	stars                            [5]int // จำนวนรีวิว 5★ 4★ 3★ 2★ 1★
	by                               []presenterReview
}

const hm = 60 // ช่วยอ่าน: 18*hm = 18:00

// 7 ร้านแรกตรงกับดีไซน์ (HANDOFF §7) ทุกตัวเลข · ร้านที่ 8 เป็นต้นไปเพิ่มเพื่อให้ทดสอบ/ดูได้ง่าย
var restaurants = []restaurantSeed{
	{"krua-rim-klong", "ครัวริมคลอง", "อาหารไทยภาคกลาง · ริมน้ำ",
		"กับข้าวไทยภาคกลางรสมือแม่ แกงเขียวหวาน ปลาทอดน้ำปลา ผัดผักบุ้งไฟแดง นั่งริมคลองรับลมเย็น ๆ\nมีที่จอดรถหน้าร้าน 4 คัน · แนะนำจองช่วงเที่ยงเพราะคนเยอะ",
		"nid", 10, 11 * hm, 22 * hm, 30, [5]int{104, 18, 3, 1, 0},
		[]presenterReview{{"somchai", 5, "แกงเขียวหวานเข้มข้นมาก นั่งริมคลองลมเย็นสบาย"}, {"mali", 4, "อร่อย แต่ช่วงเที่ยงรอนิดหน่อย จองก่อนดีกว่า"}}},
	{"somtam-na-talad", "ส้มตำหน้าตลาด", "อาหารอีสาน · ส้มตำ ไก่ย่าง",
		"ส้มตำครกใหญ่ ไก่ย่างเตาถ่าน ข้าวเหนียวร้อน ๆ รสจัดจ้านแบบอีสานแท้\nอยู่หน้าตลาดเช้า เดินจากป้ายรถเมล์ 2 นาที",
		"somsak", 24, 10 * hm, 20 * hm, 60, [5]int{220, 70, 15, 4, 2},
		[]presenterReview{{"somchai", 4, "ไก่ย่างหนังกรอบ ส้มตำเผ็ดกำลังดี"}}},
	{"kuay-tiew-ruea", "ก๋วยเตี๋ยวเรือหน้าวัด", "ก๋วยเตี๋ยวเรือ · ชามเล็ก",
		"ก๋วยเตี๋ยวเรือน้ำตกชามเล็ก หมูตุ๋นเปื่อย กากหมูกรอบ สั่งทีละหลายชามเป็นเรื่องปกติ\nเปิดเช้าถึงบ่าย หมดแล้วปิดเลย",
		"muay", 16, 9 * hm, 16 * hm, 120, [5]int{30, 18, 6, 3, 1},
		[]presenterReview{{"mali", 4, "น้ำตกเข้มข้น ชามเล็กกินได้หลายชาม"}}},
	{"khao-tom-tha-nam", "ข้าวต้มโต้รุ่งท่าน้ำ", "ข้าวต้ม กับข้าว · โต้รุ่ง",
		"ข้าวต้มร้อน ๆ กับข้าวกว่า 30 อย่าง ผัดคะน้าหมูกรอบ ไข่เจียวฟู ปลาทอด\nเปิดยาวถึงตีสอง ช่วงหลังเที่ยงคืนนับเป็นรอบของคืนเดียวกัน",
		"mali", 20, 18 * hm, 2 * hm, 60, [5]int{27, 11, 3, 1, 0}, nil},
	{"pa-daeng", "ร้านป้าแดงเปิดใหม่", "ข้าวแกง · อาหารตามสั่ง",
		"ข้าวแกงหม้อใหญ่ แกงส้ม ไข่พะโล้ และอาหารตามสั่ง ร้านเพิ่งเปิดเดือนนี้",
		"daeng", 8, 11 * hm, 19 * hm, 30, [5]int{1, 0, 0, 0, 0}, nil},
	{"khanom-jeen-khun-yai", "บ้านขนมจีนคุณยาย", "ขนมจีน · น้ำยาปักษ์ใต้",
		"ขนมจีนเส้นสดทำเองทุกเช้า น้ำยาปักษ์ใต้ แกงไตปลา ผักเหนาะเติมไม่อั้น",
		"pen", 12, 7 * hm, 14 * hm, 30, [5]int{68, 16, 4, 1, 0}, nil},
	{"kafae-tai-tun", "กาแฟใต้ถุนบ้าน", "กาแฟ ขนมไทย",
		"กาแฟโบราณชงถุงผ้า ขนมชั้น ข้าวเหนียวสังขยา นั่งใต้ถุนบ้านไม้เก่าลมโกรก",
		"mali", 12, 8 * hm, 16 * hm, 30, [5]int{15, 2, 0, 0, 0}, nil},

	// ---- ร้านเพิ่มเติม ----
	{"mookata-rim-tang", "หมูกระทะริมทาง", "หมูกระทะ · บุฟเฟต์",
		"หมูกระทะเตาถ่าน บุฟเฟต์ไม่จำกัดเวลา น้ำจิ้มสูตรเด็ด เปิดถึงตีหนึ่ง",
		"kaew", 40, 17 * hm, 1 * hm, 60, [5]int{60, 40, 12, 5, 3},
		[]presenterReview{{"somchai", 5, "หมูหมักนุ่ม น้ำจิ้มจัดจ้าน มากันเป็นแก๊งคุ้มมาก"}}},
	{"khao-man-kai", "ข้าวมันไก่ประตูน้ำ", "ข้าวมันไก่ · ต้ม ทอด",
		"ข้าวมันไก่ต้มนุ่ม ไก่ทอดกรอบ น้ำจิ้มเต้าเจี้ยวสูตรเก่า เปิดตั้งแต่ 6 โมงเช้า",
		"chai", 18, 6 * hm, 14 * hm, 30, [5]int{150, 30, 8, 2, 1},
		[]presenterReview{{"mali", 5, "ข้าวหอมมัน ไก่นุ่ม น้ำจิ้มเด็ด"}, {"somchai", 5, "มื้อเช้าที่ดีที่สุดในย่าน"}}},
	{"suki-baan-mai", "สุกี้บ้านไม้", "สุกี้ · ชาบู",
		"สุกี้น้ำซุปกระดูกเคี่ยว 8 ชั่วโมง หมูสไลซ์บาง ผักสดจากสวน โต๊ะใหญ่รองรับครอบครัว",
		"noi", 30, 11 * hm, 22 * hm, 45, [5]int{40, 35, 15, 6, 4},
		[]presenterReview{{"somchai", 4, "น้ำซุปหวานกลมกล่อม เสียดายวันหยุดคนเยอะ"}}},
	{"nam-cha-yam-chao", "ร้านน้ำชายามเช้า", "ติ่มซำ · น้ำชา",
		"ติ่มซำนึ่งร้อน ๆ ขนมจีบ ซาลาเปา น้ำชาร้อน เปิดตีห้าครึ่ง ปิดก่อนเที่ยง",
		"noi", 16, 5*hm + 30, 11 * hm, 30, [5]int{25, 10, 2, 0, 0}, nil},
	{"tom-yum-boran", "เตี๋ยวต้มยำโบราณ", "ก๋วยเตี๋ยวต้มยำ",
		"ก๋วยเตี๋ยวต้มยำน้ำข้นสูตรโบราณ ใส่ถั่วลิสงคั่ว หมูกรอบ ลูกชิ้นปลาทำเอง",
		"ya", 14, 10 * hm, 21 * hm, 30, [5]int{12, 15, 8, 3, 2}, nil},
	{"krua-tai", "ครัวใต้หรอยจังฮู้", "อาหารใต้ · แกงไตปลา คั่วกลิ้ง",
		"อาหารใต้รสจัด คั่วกลิ้ง แกงเหลือง แกงไตปลา ผักเหนาะจัดเต็ม เผ็ดตามสั่งได้",
		"somsak", 22, 10*hm + 30, 21*hm + 30, 60, [5]int{70, 20, 5, 1, 1}, nil},
	{"khao-soi-cm", "ข้าวซอยเชียงใหม่", "อาหารเหนือ · ข้าวซอย",
		"ข้าวซอยไก่น้ำแกงเข้มข้น น้ำเงี้ยว ไส้อั่ว แคบหมู สูตรจากเชียงใหม่ เพิ่งย้ายมาเปิดสาขานี้",
		"pen", 20, 9 * hm, 17 * hm, 30, [5]int{3, 1, 0, 0, 0}, nil},
	{"jok-tee-ha", "ร้านโจ๊กตีห้า", "โจ๊ก · ปาท่องโก๋ · โต้รุ่ง",
		"โจ๊กหมูสับใส่ไข่ ปาท่องโก๋ทอดใหม่ น้ำเต้าหู้ร้อน เปิดสี่ทุ่มถึงตีห้า",
		"chai", 12, 22 * hm, 5 * hm, 30, [5]int{30, 12, 3, 1, 0}, nil},
	{"somtam-saep", "ส้มตำปูปลาร้าแซ่บ", "อาหารอีสาน · ปลาร้า",
		"ตำปูปลาร้านัว ลาบหมู คอหมูย่าง ต้มแซ่บ ร้านเพิงริมถนน",
		"ya", 18, 11 * hm, 21 * hm, 30, [5]int{20, 25, 20, 10, 5}, nil},
	{"cafe-rim-na", "คาเฟ่ริมนา", "คาเฟ่ · เบเกอรี่",
		"คาเฟ่วิวทุ่งนา ครัวซองต์อบสดทุกเช้า ลาเต้เมล็ดคั่วเอง นั่งทำงานได้ทั้งวัน",
		"noi", 28, 8 * hm, 18 * hm, 120, [5]int{45, 20, 4, 1, 0}, nil},
	{"talay-chay-le", "บ้านชายเลซีฟู้ด", "อาหารทะเล · ริมหาด",
		"ซีฟู้ดสดจากเรือประมง ปูผัดผงกะหรี่ กุ้งเผา ปลากะพงนึ่งมะนาว โต๊ะริมหาดรับลมทะเล\nร้านเตรียมวัตถุดิบตามยอดจอง จึงขอให้ยกเลิกล่วงหน้า 3 ชั่วโมง",
		"kaew", 50, 11 * hm, 23 * hm, 180, [5]int{85, 40, 10, 3, 2},
		[]presenterReview{{"mali", 5, "ปูเนื้อแน่น กุ้งสดมาก วิวทะเลสวย"}}},
	{"jay-jai-dee", "ครัวมังสวิรัติใจดี", "มังสวิรัติ · อาหารเจ",
		"อาหารมังสวิรัติและอาหารเจ ผัดผักรวม แกงเขียวหวานเจ เต้าหู้ทอด ร้านเพิ่งเปิด ยังไม่มีรีวิว",
		"ya", 10, 7 * hm, 15 * hm, 30, [5]int{0, 0, 0, 0, 0}, nil},
	{"khanom-mae-mali", "ขนมไทยแม่มะลิ", "ขนมไทย · เครื่องดื่ม",
		"บัวลอยไข่หวาน ทับทิมกรอบ ขนมถ้วย ชาใบเตยเย็น ร้านเล็ก ๆ ของมะลิ",
		"mali", 8, 9 * hm, 17 * hm, 30, [5]int{2, 0, 1, 0, 0}, nil},
}

var firstNames = []string{"ต้นกล้า", "น้ำฝน", "ภูผา", "ใบเตย", "กานต์", "ปลายฟ้า", "ธนา", "มุกดา", "ก้อง", "พิมพ์", "เอกชัย", "ขวัญใจ",
	"นที", "ดาว", "วีระ", "แพรวา", "ชยพล", "อรุณี", "ปกรณ์", "จันทร์เพ็ญ", "สิทธิ", "บัว", "ณัฐ", "ลำดวน", "พงศ์", "ฝ้าย", "กิตติ", "มะปราง"}
var initials = []string{"ก.", "ข.", "จ.", "ช.", "ด.", "ต.", "ท.", "น.", "บ.", "ป.", "พ.", "ม.", "ร.", "ล.", "ว.", "ส.", "อ."}

var comments = map[int][]string{
	5: {"อร่อยมาก ต้องกลับมาอีก", "รสชาติจัดจ้าน ถูกปากสุด ๆ", "บริการดี อาหารออกไว", "บรรยากาศดีมาก พาครอบครัวมาทุกคนชอบ", "",
		"คุ้มค่ามาก ราคาไม่แรง", "จองผ่านแอปสะดวก ไปถึงมีโต๊ะรอเลย", "วัตถุดิบสด ปรุงถึงเครื่อง", "พนักงานยิ้มแย้ม แนะนำเมนูดี", ""},
	4: {"อร่อย แต่ช่วงเที่ยงคนเยอะรอนิดหน่อย", "โดยรวมดี ที่จอดรถหายาก", "อาหารดี น้ำจิ้มเด็ด", "", "รสชาติดี ราคาสูงไปนิด", "ร้านสะอาด อาหารออกช้านิดหน่อย"},
	3: {"พอใช้ได้ รสชาติกลาง ๆ", "วันนี้อาหารออกช้า", "", "ที่นั่งแคบไปหน่อย"},
	2: {"รสชาติไม่เหมือนเดิม", "รอนานเกินไป", "เค็มไปหน่อย"},
	1: {"ผิดหวังกับรอบนี้", "จองแล้วยังต้องรอโต๊ะ"},
}

// Run ใส่ข้อมูลตัวอย่าง · ถ้ามี user อยู่แล้วจะไม่ทำอะไร (รันซ้ำได้ ไม่ซ้ำข้อมูล)
// การจองนับวันจาก "วันที่รัน seed" → เปิดมาเมื่อไหร่ก็เห็นการจองที่ยังไม่ถึงเวลา
func Run(db *gorm.DB, uploadDir string) error {
	if err := EnsureImages(uploadDir); err != nil {
		return err
	}
	var count int64
	if err := db.Model(&models.User{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		log.Println("seed: มีข้อมูลอยู่แล้ว ข้าม (ล้างแล้วใส่ใหม่: SEED_ON_START=reset หรือ go run ./cmd/seed -reset)")
		return nil
	}

	now := time.Now()
	rng := rand.New(rand.NewPCG(2569, 10)) // seed คงที่ → รันกี่ครั้งก็ได้ข้อมูลหน้าตาเดิม
	hash, err := bcrypt.GenerateFromPassword([]byte(Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	users := map[string]*models.User{}
	var reviewers []*models.User
	shops := map[string]*models.Restaurant{}
	reviewCount := 0

	err = db.Transaction(func(tx *gorm.DB) error {
		// ---- บัญชีสำหรับ present 2 บัญชี + เจ้าของร้านอื่น ๆ ----
		named := []struct{ key, name, email string }{
			{"mali", "มะลิ ศรีสุข", "usr1@email.com"},   // present: เจ้าของ 3 ร้าน + เป็นลูกค้าร้านอื่น
			{"somchai", "สมชาย ใจดี", "usr2@email.com"}, // present: ลูกค้า
			{"nid", "เชฟนิด ริมคลอง", "nid@example.com"},
			{"somsak", "ลุงสมศักดิ์", "somsak@example.com"},
			{"muay", "เจ๊หมวย", "muay@example.com"},
			{"daeng", "ป้าแดง", "daeng@example.com"},
			{"pen", "ยายเพ็ญ", "pen@example.com"},
			{"kaew", "พี่แก้ว ชายเล", "kaew@example.com"},
			{"chai", "เฮียชัย", "chai@example.com"},
			{"noi", "น้อยหน่า", "noi@example.com"},
			{"ya", "ยาใจ", "ya@example.com"},
		}
		testHash, err := bcrypt.GenerateFromPassword([]byte(TestPassword), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		for _, n := range named {
			u := &models.User{Name: n.name, Email: n.email, PasswordHash: string(hash)}
			if n.key == "mali" || n.key == "somchai" {
				u.PasswordHash = string(testHash)
			}
			if err := tx.Create(u).Error; err != nil {
				return err
			}
			users[n.key] = u
		}

		// ---- ผู้รีวิว 400 คน (1 คนรีวิวได้ครั้งเดียวต่อร้าน → ร้านที่มี 311 รีวิวต้องมีคนอย่างน้อย 311 คน) ----
		batch := make([]*models.User, 400)
		for i := range batch {
			batch[i] = &models.User{
				Name:         firstNames[i%len(firstNames)] + " " + initials[(i/len(firstNames))%len(initials)],
				Email:        fmt.Sprintf("reviewer%03d@example.com", i+1),
				PasswordHash: string(hash),
			}
		}
		if err := tx.CreateInBatches(batch, 100).Error; err != nil {
			return err
		}
		reviewers = batch

		// ---- ร้าน + รูป (ไฟล์รูปเขียนไว้แล้วตอนต้น Run) ----
		for _, s := range restaurants {
			r := &models.Restaurant{
				OwnerID: users[s.owner].ID, Name: s.name, Cuisine: s.cuisine, Description: s.description,
				Seats: s.seats, OpenMinute: s.open, CloseMinute: s.close, CancelLeadMinutes: s.lead,
			}
			urls, err := imageURLs(s.slug)
			if err != nil {
				return err
			}
			for i, url := range urls {
				r.Images = append(r.Images, models.RestaurantImage{URL: url, Position: i})
			}
			if err := tx.Create(r).Error; err != nil {
				return err
			}
			shops[s.slug] = r
		}

		// ---- รีวิว: จำนวนแต่ละดาวตามที่กำหนด → ค่าเฉลี่ย/จำนวนรีวิวตรงตาราง ----
		var reviews []models.Review
		for _, s := range restaurants {
			var stars []int
			for star := 5; star >= 1; star-- {
				for n := 0; n < s.stars[5-star]; n++ {
					stars = append(stars, star)
				}
			}
			authors := make([]*models.User, len(stars))
			texts := make([]string, len(stars))
			// รีวิวของบัญชี present ใช้ "ช่อง" ของดาวนั้น → จำนวนรวมไม่เปลี่ยน
			for _, p := range s.by {
				for i, star := range stars {
					if star == p.star && authors[i] == nil {
						authors[i], texts[i] = users[p.who], p.comment
						break
					}
				}
			}
			pool := rng.Perm(len(reviewers)) // สุ่มลำดับคน → แต่ละร้านได้คนไม่ซ้ำกัน
			k := 0
			for i, star := range stars {
				if authors[i] == nil {
					authors[i] = reviewers[pool[k]]
					k++
					cs := comments[star]
					texts[i] = cs[rng.IntN(len(cs))]
				}
				at := now.Add(-time.Duration(1+rng.IntN(180*24)) * time.Hour)
				reviews = append(reviews, models.Review{
					RestaurantID: shops[s.slug].ID, UserID: authors[i].ID, Rating: star,
					Comment: texts[i], CreatedAt: at, UpdatedAt: at,
				})
			}
		}
		reviewCount = len(reviews)
		return tx.CreateInBatches(reviews, 200).Error
	})
	if err != nil {
		return err
	}

	// ---- การจอง: ใช้ booking.Create ตัวเดียวกับ API → การจองตัวอย่างผ่านกติกาจริงทุกข้อ ----
	// ทั้งหมดอยู่ใน transaction เดียว → commit ครั้งเดียวแทนราวพันครั้ง
	// booking.Create/Cancel ข้างในกลายเป็น SAVEPOINT → จองไม่ผ่านก็ย้อนเฉพาะรายการนั้น ที่เหลือไปต่อได้
	err = db.Transaction(func(tx *gorm.DB) error {
		today := now.In(booking.Loc)
		day := func(offset int) string { return today.AddDate(0, 0, offset).Format(booking.DateLayout) }
		book := func(slug string, user *models.User, date, start, end string, party int) *models.Booking {
			b, err := booking.Create(tx, shops[slug].ID, user.ID, booking.Input{Date: date, Start: start, End: end, PartySize: party}, now)
			if err != nil {
				log.Printf("seed: ข้ามการจอง %s %s %s–%s (%v)", shops[slug].Name, date, start, end, err)
				return nil
			}
			return b
		}
		cancel := func(b *models.Booking, user *models.User) {
			if b != nil {
				_ = booking.Cancel(tx, b.ID, user.ID, now)
			}
		}
		somchai, mali := users["somchai"], users["mali"]

		// ===== สมชาย (ลูกค้า) — การจองครบทุกสถานะ =====
		// เคสเดโมจากโจทย์: ครัวริมคลอง 10 ที่ พรุ่งนี้ 12:00–13:00 สมชาย 7 + อีกคน 3 = เต็มพอดี → ลองแก้ 7→8 ✕ / 7→5 ✓
		book("krua-rim-klong", somchai, day(1), "12:00", "13:00", 7)
		book("krua-rim-klong", reviewers[0], day(1), "12:00", "13:00", 3)
		// วันนี้ (ต้นขั้วสีชาด) — ถ้าเวลาผ่านไปแล้วจะถูกข้ามเอง
		book("mookata-rim-tang", somchai, day(0), "20:00", "21:30", 4)
		book("khao-tom-tha-nam", somchai, day(0), "22:00", "23:00", 2)
		// เลยเวลายกเลิกแล้ว: ร้านทะเล (11:00–23:00) ให้ยกเลิกล่วงหน้า 3 ชม. แต่การจองนี้เริ่มในอีกไม่ถึงชั่วโมง → ปุ่มแก้/ยกเลิก disabled
		// นาน 2 ชม. (ไม่เกินเวลาปิด) → การ์ดอยู่ในแท็บ "กำลังจะถึง" ได้ราว 2 ชม. ครึ่งหลัง seed · มีเมื่อ seed ช่วงราว 10:00–21:30
		if start := nextHalfHour(today).Add(30 * time.Minute); start.Day() == today.Day() && start.Hour() >= 11 && start.Hour() < 22 {
			end := start.Add(2 * time.Hour)
			if closeAt := booking.At(today, 23*hm); end.After(closeAt) {
				end = closeAt
			}
			book("talay-chay-le", somchai, day(0), start.Format("15:04"), end.Format("15:04"), 2)
		}
		book("khao-tom-tha-nam", somchai, day(1), "23:30", "01:00", 2) // ร้านข้ามเที่ยงคืน
		book("suki-baan-mai", somchai, day(2), "19:00", "20:30", 4)
		book("cafe-rim-na", somchai, day(3), "14:00", "15:00", 2)
		book("talay-chay-le", somchai, day(4), "18:00", "20:00", 6)
		book("jok-tee-ha", somchai, day(5), "02:00", "03:00", 2) // โจ๊กรอบคืนวันที่ +5 = ตีสองของวันถัดไป
		book("khao-soi-cm", somchai, day(6), "12:00", "13:00", 3)
		book("krua-tai", somchai, day(7), "18:30", "20:00", 5)
		// ยกเลิกแล้ว
		cancel(book("somtam-na-talad", somchai, day(2), "18:00", "19:00", 4), somchai)
		cancel(book("kuay-tiew-ruea", somchai, day(1), "10:00", "11:00", 2), somchai)

		// ===== มะลิ (เจ้าของ 3 ร้าน) — เป็นลูกค้าร้านอื่นด้วย =====
		book("cafe-rim-na", mali, day(1), "10:00", "11:00", 2)
		book("krua-tai", mali, day(2), "18:00", "19:30", 3)
		book("khanom-jeen-khun-yai", mali, day(3), "09:00", "10:00", 2)
		book("suki-baan-mai", mali, day(5), "12:00", "13:00", 4)
		cancel(book("tom-yum-boran", mali, day(4), "12:00", "13:00", 2), mali)

		// ===== การจองที่ผ่านมาแล้ว =====
		// กติกา "ห้ามจองเวลาที่ผ่านไปแล้ว" ทำให้สร้างผ่าน booking.Create ไม่ได้ (ตั้งใจ) จึงใส่ตรง ๆ
		past := []struct {
			slug      string
			user      *models.User
			daysAgo   int
			start     int
			end       int
			party     int
			cancelled bool
		}{
			// สมชาย: ร้านที่รีวิวแล้ว → ป้าย "รีวิวแล้ว" · ร้านที่ยังไม่รีวิว → ปุ่ม "เขียนรีวิว"
			{"cafe-rim-na", somchai, 2, 10 * hm, 11 * hm, 2, false},         // ยังไม่รีวิว
			{"khanom-jeen-khun-yai", somchai, 3, 9 * hm, 10 * hm, 3, false}, // ยังไม่รีวิว
			{"somtam-na-talad", somchai, 6, 12 * hm, 13 * hm, 4, false},     // รีวิวแล้ว
			{"krua-rim-klong", somchai, 10, 18 * hm, 19*hm + 30, 2, false},  // รีวิวแล้ว
			{"mookata-rim-tang", somchai, 12, 19 * hm, 21 * hm, 5, false},   // รีวิวแล้ว
			{"suki-baan-mai", somchai, 18, 18*hm + 30, 20 * hm, 3, false},   // รีวิวแล้ว
			{"khao-soi-cm", somchai, 25, 12 * hm, 13 * hm, 2, false},        // ยังไม่รีวิว
			{"khao-man-kai", somchai, 30, 7 * hm, 7*hm + 30, 1, false},      // รีวิวแล้ว
			{"khao-tom-tha-nam", somchai, 9, 19 * hm, 20 * hm, 2, true},     // ยกเลิกไปแล้ว
			// มะลิในฐานะลูกค้า
			{"talay-chay-le", mali, 8, 18 * hm, 20 * hm, 4, false},   // รีวิวแล้ว
			{"khao-man-kai", mali, 15, 8 * hm, 9 * hm, 2, false},     // รีวิวแล้ว
			{"kuay-tiew-ruea", mali, 20, 11 * hm, 12 * hm, 2, false}, // รีวิวแล้ว
			{"krua-rim-klong", mali, 5, 12 * hm, 13 * hm, 2, false},  // รีวิวแล้ว
			{"nam-cha-yam-chao", mali, 4, 7 * hm, 8 * hm, 3, false},  // ยังไม่รีวิว
		}
		for _, p := range past {
			date := today.AddDate(0, 0, -p.daysAgo)
			b := models.Booking{
				RestaurantID: shops[p.slug].ID, UserID: p.user.ID, PartySize: p.party,
				ServiceDate: booking.DateOnly(date), StartAt: booking.At(date, p.start), EndAt: booking.At(date, p.end),
				Status: models.StatusConfirmed,
			}
			if p.cancelled {
				at := booking.At(date, p.start).Add(-24 * time.Hour)
				b.Status, b.CancelledAt = models.StatusCancelled, &at
			}
			if err := tx.Create(&b).Error; err != nil {
				return err
			}
		}

		// ===== การจองสุ่มของผู้รีวิว วันนี้ถึงอีก 7 วัน → กราฟที่นั่งและ dashboard มีข้อมูล =====
		// (ไม่เกิน 7 วัน → วันที่ +10/+11 ที่ requests.http ใช้ทดสอบว่างแน่นอน)
		for _, s := range restaurants {
			closeM := s.close
			if booking.CrossesMidnight(s.open, s.close) {
				closeM += 1440
			}
			perDay := 3 + s.seats/5
			if s.owner == "mali" {
				perDay += 4 // ร้านของมะลิคึกคักกว่า → dashboard ตอน present ดูง่าย
			}
			for d := 0; d <= 7; d++ {
				for n := 0; n < perDay+rng.IntN(3); n++ {
					length := 60 + 30*rng.IntN(3)
					slots := (closeM - s.open - length) / 30
					if slots < 0 {
						continue
					}
					start := s.open + 30*rng.IntN(slots+1)
					party := 1 + rng.IntN(max(1, min(8, s.seats/3)))
					// ช่วงเดโมของครัวริมคลองพรุ่งนี้ ให้เคส 7 + 3 = 10 คงเดิม
					if s.slug == "krua-rim-klong" && d == 1 && start < 14*hm && start+length > 11*hm {
						continue
					}
					who := reviewers[rng.IntN(len(reviewers))]
					b, err := booking.Create(tx, shops[s.slug].ID, who.ID,
						booking.Input{Date: day(d), Start: booking.FormatHHMM(start), End: booking.FormatHHMM(start + length), PartySize: party}, now)
					if err == nil && rng.IntN(100) < 8 {
						cancel(b, who) // ~8% ยกเลิก → เจ้าของร้านเห็นสถานะ "ยกเลิกแล้ว" ในตาราง
					}
				}
			}
		}
		return nil
	})
	if err != nil {
		return err
	}

	var bookings int64
	db.Model(&models.Booking{}).Count(&bookings)
	log.Printf("seed: ผู้ใช้ %d · ร้าน %d · รีวิว %d · การจอง %d · รหัสผ่านทุกบัญชี %s",
		len(users)+len(reviewers), len(shops), reviewCount, bookings, Password)
	return nil
}

// nextHalfHour ปัดเวลาขึ้นเป็น :00 หรือ :30 ถัดไป
func nextHalfHour(t time.Time) time.Time {
	return t.Truncate(30 * time.Minute).Add(30 * time.Minute)
}

// seedFileName ชื่อไฟล์ใน uploads ของรูปที่ฝังไว้ · ต้องเข้ารูปแบบ managedUpload (handlers/uploads.go) ไม่งั้น CleanUploads ไม่รู้จัก
func seedFileName(name string) string {
	return "seed-" + strings.ToLower(path.Base(name))
}

// imageURLs URL รูปของร้าน เรียงตามชื่อไฟล์ (ไฟล์จริงเขียนโดย EnsureImages)
func imageURLs(slug string) ([]string, error) {
	names, err := fs.Glob(imagesFS, "images/"+slug+"-*")
	if err != nil {
		return nil, err
	}
	sort.Strings(names)
	urls := make([]string, len(names))
	for i, name := range names {
		urls[i] = "/uploads/" + seedFileName(name)
	}
	return urls, nil
}

// EnsureImages เขียนรูปตัวอย่างลง uploads ถ้ายังไม่มีไฟล์ · Run เรียกทุกครั้ง แม้ DB มีข้อมูลแล้ว
// กรณี DB มีข้อมูลแล้วแต่โฟลเดอร์ uploads ว่าง (เช่น volume ของ Docker ถูกสร้างใหม่) รูปจะได้ไม่หาย
func EnsureImages(uploadDir string) error {
	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		return err
	}
	names, err := fs.Glob(imagesFS, "images/*")
	if err != nil {
		return err
	}
	for _, name := range names {
		dst := filepath.Join(uploadDir, seedFileName(name))
		if _, err := os.Stat(dst); err == nil {
			continue
		}
		data, err := imagesFS.ReadFile(name)
		if err != nil {
			return err
		}
		if err := os.WriteFile(dst, data, 0o644); err != nil {
			return err
		}
	}
	return nil
}

// Reset ลบทุกตาราง (ต้อง Migrate ต่อ) · ใช้ตอน SEED_ON_START=reset และ go run ./cmd/seed -reset
func Reset(db *gorm.DB) error {
	return db.Migrator().DropTable(&models.Review{}, &models.Booking{}, &models.RestaurantImage{}, &models.Restaurant{}, &models.User{})
}

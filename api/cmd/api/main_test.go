package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"
)

// ทดสอบค่าใน newApp ผ่าน server จริงบน 127.0.0.1 (ไม่ใช้ app.Test เพราะ app.Test ส่งคำขอจาก 0.0.0.0
// ซึ่งไม่ใช่ loopback → ทดสอบการเชื่อ X-Forwarded-For ไม่ได้ และไม่ผ่าน read buffer ของ server จริง)
func startServer(t *testing.T) string {
	t.Helper()
	app := newApp()
	app.Get("/ip", func(c fiber.Ctx) error { return c.SendString(c.IP()) })
	app.Post("/size", func(c fiber.Ctx) error { return c.SendString(strconv.Itoa(len(c.Body()))) })
	app.Get("/panic", func(fiber.Ctx) error { panic("boom") })

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	go app.Listener(ln, fiber.ListenConfig{DisableStartupMessage: true})
	t.Cleanup(func() { app.ShutdownWithTimeout(time.Second) })
	return "http://" + ln.Addr().String()
}

func get(t *testing.T, url string, header map[string]string) (int, string) {
	t.Helper()
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	for k, v := range header {
		req.Header.Set(k, v)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	return res.StatusCode, string(body)
}

func TestHeaderSizeLimit(t *testing.T) {
	base := startServer(t)
	// cookie session ของ NextAuth ใหญ่เกิน 4KB (default ของ Fiber) ได้ → ต้องรับได้ถึงราว 16KB
	if s, _ := get(t, base+"/ip", map[string]string{"Cookie": "s=" + strings.Repeat("a", 12*1024)}); s != 200 {
		t.Errorf("header 12KB: %d; want 200", s)
	}
	if s, _ := get(t, base+"/ip", map[string]string{"Cookie": "s=" + strings.Repeat("a", 20*1024)}); s != http.StatusRequestHeaderFieldsTooLarge {
		t.Errorf("header 20KB: %d; want 431", s)
	}
}

func TestForwardedIPFromLocalProxy(t *testing.T) {
	base := startServer(t)
	cases := []struct {
		name, xff, want string
	}{
		{"ไม่มี header = IP ของผู้ส่ง", "", "127.0.0.1"},
		{"Next ส่งต่อ IP ผู้ใช้", "203.0.113.7", "203.0.113.7"},
		{"หลายชั้น เอาตัวแรก", "203.0.113.7, 10.0.0.2", "203.0.113.7"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			h := map[string]string{}
			if c.xff != "" {
				h["X-Forwarded-For"] = c.xff
			}
			if _, got := get(t, base+"/ip", h); got != c.want {
				t.Errorf("IP = %q; want %q", got, c.want)
			}
		})
	}
	// ค่าที่ไม่ใช่ IP ต้องไม่ถูกใช้เป็น key ของ rate limit (สุ่มค่าใหม่ทุกคำขอ = หลบการนับได้)
	if _, got := get(t, base+"/ip", map[string]string{"X-Forwarded-For": "random-123"}); strings.Contains(got, "random") {
		t.Errorf("IP = %q; ต้องไม่ใช่ค่าที่ไม่ใช่ IP", got)
	}
}

func TestBodyLimit(t *testing.T) {
	base := startServer(t)
	post := func(n int) int {
		res, err := http.Post(base+"/size", "application/octet-stream", bytes.NewReader(make([]byte, n)))
		if err != nil {
			// server ตัดการเชื่อมต่อตอน body ใหญ่เกินก็นับว่าถูกปฏิเสธ
			return http.StatusRequestEntityTooLarge
		}
		defer res.Body.Close()
		return res.StatusCode
	}
	if s := post(6 << 20); s != 200 {
		t.Errorf("body 6MB (รูป 5MB + ฟอร์ม): %d; want 200", s)
	}
	if s := post(11 << 20); s != http.StatusRequestEntityTooLarge {
		t.Errorf("body 11MB: %d; want 413", s)
	}
}

func TestPanicBecomes500(t *testing.T) {
	base := startServer(t)
	s, body := get(t, base+"/panic", nil)
	var eb struct {
		Error struct{ Code string } `json:"error"`
	}
	json.Unmarshal([]byte(body), &eb)
	if s != 500 || eb.Error.Code != "INTERNAL" {
		t.Errorf("panic: %d %s; want 500 INTERNAL", s, body)
	}
	// server ยังทำงานต่อได้
	if s, _ := get(t, base+"/ip", nil); s != 200 {
		t.Errorf("หลัง panic: %d", s)
	}
}

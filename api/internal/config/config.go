package config

import "os"

// Config เก็บค่าที่อ่านจาก environment variable
// ไม่ได้ตั้ง DATABASE_URL = รันแบบ dev ในเครื่อง → ใช้ DB ตาม docker-compose.yml ได้เลยไม่ต้องตั้ง env
type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string // ว่าง = ใช้กุญแจที่สุ่มเก็บไว้ใน DB (database.JWTSecret) · ไม่มีค่า default ที่ใครก็รู้
	UploadDir   string
	SeedOnStart string // "reset" = ล้างแล้ว seed ใหม่ทุกครั้งที่เริ่ม · "true" = seed ถ้า DB ว่าง · "false" = ไม่ seed
}

const devDatabaseURL = "postgres://toawang:toawang@localhost:5433/toawang?sslmode=disable"

func Load() Config {
	cfg := Config{
		Port:        getenv("PORT", "8080"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		JWTSecret:   os.Getenv("JWT_SECRET"),
		UploadDir:   getenv("UPLOAD_DIR", "uploads"),
	}
	// ล้างข้อมูลเองโดยไม่ต้องสั่ง ได้เฉพาะ DB dev ในเครื่อง · ชี้ไป DB อื่นแล้วต้องตั้ง SEED_ON_START=reset เอง
	seedDefault := "false"
	if cfg.DatabaseURL == "" {
		cfg.DatabaseURL = devDatabaseURL
		seedDefault = "reset"
	}
	cfg.SeedOnStart = getenv("SEED_ON_START", seedDefault)
	return cfg
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

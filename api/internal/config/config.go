package config

import "os"

// Config เก็บค่าที่อ่านจาก environment variable
// ถ้าไม่ได้ตั้งไว้จะใช้ค่า default ที่ตรงกับ docker-compose.yml (รันแบบ dev ได้เลยไม่ต้องตั้ง env)
type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string
	UploadDir   string
	SeedOnStart string // "reset" = ล้างแล้ว seed ใหม่ทุกครั้งที่เริ่ม · "true" = seed ถ้า DB ว่าง · "false" = ไม่ seed
}

func Load() Config {
	return Config{
		Port:        getenv("PORT", "8080"),
		DatabaseURL: getenv("DATABASE_URL", "postgres://toawang:toawang@localhost:5433/toawang?sslmode=disable"),
		JWTSecret:   getenv("JWT_SECRET", "dev-secret-change-me"),
		UploadDir:   getenv("UPLOAD_DIR", "uploads"),
		SeedOnStart: getenv("SEED_ON_START", "reset"),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

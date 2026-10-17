package config

import "testing"

func TestLoadDevDefaults(t *testing.T) {
	for _, k := range []string{"PORT", "DATABASE_URL", "JWT_SECRET", "UPLOAD_DIR", "SEED_ON_START"} {
		t.Setenv(k, "")
	}
	cfg := Load()
	if cfg.Port != "8080" || cfg.UploadDir != "uploads" || cfg.JWTSecret != "" {
		t.Errorf("cfg = %+v", cfg)
	}
	// ไม่ตั้ง DATABASE_URL = DB dev ในเครื่อง → reset ได้เอง
	if cfg.DatabaseURL != devDatabaseURL || cfg.SeedOnStart != "reset" {
		t.Errorf("dev: DatabaseURL %q SeedOnStart %q", cfg.DatabaseURL, cfg.SeedOnStart)
	}
}

func TestLoadOtherDatabaseNeverResetsByDefault(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://prod")
	t.Setenv("SEED_ON_START", "")
	if cfg := Load(); cfg.SeedOnStart != "false" {
		t.Errorf("SeedOnStart = %q; want false", cfg.SeedOnStart)
	}

	t.Setenv("SEED_ON_START", "reset")
	if cfg := Load(); cfg.SeedOnStart != "reset" {
		t.Errorf("ตั้งเองต้องใช้ค่าที่ตั้ง: %q", cfg.SeedOnStart)
	}
}

func TestLoadFromEnv(t *testing.T) {
	t.Setenv("PORT", "9000")
	t.Setenv("JWT_SECRET", "s")
	t.Setenv("UPLOAD_DIR", "/data")
	cfg := Load()
	if cfg.Port != "9000" || cfg.JWTSecret != "s" || cfg.UploadDir != "/data" {
		t.Errorf("cfg = %+v", cfg)
	}
}

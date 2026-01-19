package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL   string
	RedisEndpoint string
	RedisPassword string
	Port          string
	SeedCount     int
}

func Load() *Config {
	_ = godotenv.Load()

	config := &Config{
		DatabaseURL:   os.Getenv("DATABASE_URL"),
		RedisEndpoint: os.Getenv("UPSTASH_REDIS_ENDPOINT"),
		RedisPassword: os.Getenv("UPSTASH_REDIS_REST_TOKEN"),
		Port:          getEnvOrDefault("PORT", "8080"),
		SeedCount:     10000,
	}

	// Validate it bro
	if config.DatabaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}
	if config.RedisEndpoint == "" {
		log.Fatal("UPSTASH_REDIS_ENDPOINT is required")
	}
	if config.RedisPassword == "" {
		log.Fatal("UPSTASH_REDIS_PASSWORD is required")
	}

	return config
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

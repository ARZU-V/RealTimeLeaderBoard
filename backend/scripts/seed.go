package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"matiks-leaderboard/config"
	"matiks-leaderboard/internals/database"
	"matiks-leaderboard/pkg/utils"
	"github.com/redis/go-redis/v9"
)

func main() {
	log.Println("🌱 Starting seed process...")

	// Load config
	cfg := config.Load()

	// Connect to databases
	pg, err := database.NewPostgresDB(cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pg.Close()

	rdb, err := database.NewRedisDB(cfg.RedisEndpoint)
	if err != nil {
		log.Fatal(err)
	}
	defer rdb.Close()

	// Clear existing data
	log.Println(" Clearing existing data...")
	if err := clearData(pg.DB, rdb.Client); err != nil {
		log.Fatal(err)	
	}

	// Seed users
	log.Printf("Seeding %d users...\n", cfg.SeedCount)
	if err := seedUsers(pg.DB, rdb.Client, cfg.SeedCount); err != nil {
		log.Fatal(err)
	}

	log.Println("Seed completed successfully!")
}

func clearData(db *sql.DB, rdb *redis.Client) error {
	ctx := context.Background()

	// Clear PostgreSQL
	if _, err := db.Exec("TRUNCATE users RESTART IDENTITY CASCADE"); err != nil {
		return fmt.Errorf("failed to clear postgres: %w", err)
	}

	// Clear Redis
	if err := rdb.Del(ctx, "leaderboard").Err(); err != nil {
		return fmt.Errorf("failed to clear redis: %w", err)
	}

	return nil
}

func seedUsers(db *sql.DB, rdb *redis.Client, count int) error {
	ctx := context.Background()
	batchSize := 1000
	
	// Prepare statement for PostgreSQL
	stmt, err := db.Prepare("INSERT INTO users (username, rating) VALUES ($1, $2)")
	if err != nil {
		return err
	}
	defer stmt.Close()

	// Redis pipeline for batch inserts
	pipe := rdb.Pipeline()
	
	startTime := time.Now()
	
	for i := 0; i < count; i++ {
		username := utils.GenerateUsername(i + 1)
		rating := utils.GenerateRating()

		// Insert into PostgreSQL
		if _, err := stmt.Exec(username, rating); err != nil {
			return fmt.Errorf("failed to insert user %s: %w", username, err)
		}

		// Add to Redis sorted set (pipeline)
		pipe.ZAdd(ctx, "leaderboard", redis.Z{
			Score:  float64(rating),
			Member: username,
		})

		// Execute pipeline batch
		if (i+1)%batchSize == 0 {
			if _, err := pipe.Exec(ctx); err != nil {
				return fmt.Errorf("failed to execute redis pipeline: %w", err)
			}
			pipe = rdb.Pipeline() // Reset pipeline
			log.Printf("   Inserted %d/%d users (%.1f%%)", i+1, count, float64(i+1)/float64(count)*100)
		}
	}

	// Execute remaining items in pipeline
	if _, err := pipe.Exec(ctx); err != nil {
		return fmt.Errorf("failed to execute final redis pipeline: %w", err)
	}

	duration := time.Since(startTime)
	log.Printf("⏱Seeded %d users in %v (%.0f users/sec)", count, duration, float64(count)/duration.Seconds())

	return nil
}
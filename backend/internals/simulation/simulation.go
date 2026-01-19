package simulation

import (
	"context"
	"database/sql"
	"log"
	"math/rand"
	"time"

	"matiks-leaderboard/internals/services"
)

func Start(db *sql.DB, service *services.LeaderboardService) {
	log.Println("=================================================")
	log.Println("🤖 TOP 100 SIMULATION ACTIVE")
	log.Println("   - Targeting ONLY Ranks 1-100")
	log.Println("   - Updates every 200ms")
	log.Println("=================================================")

	go func() {
		ticker := time.NewTicker(200 * time.Millisecond) // 5 updates/sec
		defer ticker.Stop()

		for range ticker.C {
			performTopRankUpdate(db, service)
		}
	}()
}

func performTopRankUpdate(db *sql.DB, service *services.LeaderboardService) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	var username string
	var currentRating int

	// 1. SELECT ONE RANDOM USER FROM THE TOP 100 ONLY
	// We use a subquery to get the top 100, then shuffle them to pick one.
	query := `
		SELECT username, rating 
		FROM (
			SELECT username, rating 
			FROM users 
			ORDER BY rating DESC 
			LIMIT 100
		) top_users 
		ORDER BY RANDOM() 
		LIMIT 1
	`

	err := db.QueryRowContext(ctx, query).Scan(&username, &currentRating)
	if err != nil {
		log.Printf("⚠️ Sim Error: Could not fetch top user: %v", err)
		return
	}

	// 2. CALCULATE CHANGE
	// Since these are top players, we want volatile movement.
	// We give a higher chance of losing points to allow lower ranks to climb up.
	var change int

	// 60% chance to lose points (Gravity effect for top players)
	if rand.Intn(100) < 60 {
		change = -rand.Intn(50) - 10 // Drop between 10 and 60 points
	} else {
		change = rand.Intn(40) + 5 // Gain between 5 and 45 points
	}

	newRating := currentRating + change

	// 3. CLAMP LIMITS
	if newRating < 100 {
		newRating = 100
	}
	if newRating > 5000 {
		newRating = 5000
	}

	// 4. UPDATE
	err = service.UpdateRating(ctx, username, newRating)
	if err != nil {
		log.Printf("❌ Failed: %v", err)
		return
	}

	// 5. LOGGING
	indicator := "➖"
	if change > 0 {
		indicator = "🟢 UP  "
	} else {
		indicator = "🔻 DOWN"
	}

	log.Printf("%s | %-15s | %4d -> %4d | Diff: %d", indicator, username, currentRating, newRating, change)
}

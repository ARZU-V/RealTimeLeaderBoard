package simulation

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"math/rand"
	"sync"
	"time"

	"matiks-leaderboard/internals/services"
)

// Global state for the simulation
var (
	isActive bool = false
	simMutex sync.Mutex
)

// GetState returns the current simulation status safely
func GetState() bool {
	simMutex.Lock()
	defer simMutex.Unlock()
	return isActive
}

// SetState updates the simulation status safely
func SetState(active bool) {
	simMutex.Lock()
	defer simMutex.Unlock()
	isActive = active

	status := "STOPPED"
	if active {
		status = "ACTIVE"
	}
	log.Printf("🔄 Simulation State Changed: %s", status)
}

func Start(db *sql.DB, service *services.LeaderboardService) {
	log.Println("=================================================")
	log.Println("🤖 TIERED BATCH SIMULATION STARTED")
	log.Println("=================================================")

	go func() {
		// Slower ticker: Update every 500ms (Safe for localhost)
		ticker := time.NewTicker(200 * time.Millisecond)
		defer ticker.Stop()

		cycle := 0

		for range ticker.C {
			if GetState() {
				// REMOVED 'go' KEYWORD BELOW
				// This forces the code to WAIT for the update to finish
				// before starting the next one. prevents crashes.
				if cycle%2 == 0 {
					performBatchUpdate(db, service, 100, 1, 500)
				} else {
					performBatchUpdate(db, service, 50, 501, 1000)
				}
				cycle++
			}
		}
	}()
}

func performBatchUpdate(db *sql.DB, service *services.LeaderboardService, volatility int, minRank, maxRank int) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	limit := maxRank - minRank + 1
	offset := minRank - 1
	batchSize := 10

	query := fmt.Sprintf(`
		SELECT username, rating 
		FROM (
			SELECT username, rating 
			FROM users 
			ORDER BY rating DESC 
			LIMIT %d OFFSET %d
		) tier_users 
		ORDER BY RANDOM() 
		LIMIT %d
	`, limit, offset, batchSize)

	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		log.Printf("⚠️ Sim Error: Could not fetch batch: %v", err)
		return
	}
	defer rows.Close()

	// 2. Process updates concurrently
	var wg sync.WaitGroup

	for rows.Next() {
		var username string
		var currentRating int
		if err := rows.Scan(&username, &currentRating); err != nil {
			continue
		}

		wg.Add(1)
		go func(u string, r int) {
			defer wg.Done()

			// Calculate Change based on volatility
			// Higher tiers (Elite) have higher volatility (bigger swings)
			change := 0
			if rand.Intn(100) < 50 {
				change = rand.Intn(volatility) + 5 // Gain
			} else {
				change = -rand.Intn(volatility) - 5 // Loss
			}

			newRating := r + change

			// Clamp Limits
			if newRating < 100 {
				newRating = 100
			}
			if newRating > 5000 {
				newRating = 5000
			}

			// Update Service
			if err := service.UpdateRating(ctx, u, newRating); err == nil {
				// Log simplified output
				// log.Printf("⚡ %s: %d -> %d (%d)", u, r, newRating, change)
			}
		}(username, currentRating)
	}

	wg.Wait()
	// log.Printf("✅ Updated batch in Tier %d-%d", minRank, maxRank)
}

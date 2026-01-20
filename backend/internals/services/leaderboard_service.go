package services

import (
	"context"
	"database/sql"
	"fmt"
	"sync"

	"matiks-leaderboard/internals/models"

	"github.com/redis/go-redis/v9"
)

type LeaderboardService struct {
	db    *sql.DB
	redis *redis.Client
	cache *sync.Map // In-memory cache for hot data
}

func NewLeaderboardService(db *sql.DB, rdb *redis.Client) *LeaderboardService {
	return &LeaderboardService{
		db:    db,
		redis: rdb,
		cache: &sync.Map{},
	}
}

// GetLeaderboard - OPTIMIZED: Fetches raw data range from Redis
// Does NOT calculate rank here to allow batch processing in Handler.
func (s *LeaderboardService) GetLeaderboard(ctx context.Context, start, stop int) ([]models.LeaderboardEntry, int64, error) {
	// 1. Get total count
	total := s.redis.ZCard(ctx, "leaderboard").Val()

	// 2. Get users from Redis (sorted by rating DESC)
	results, err := s.redis.ZRevRangeWithScores(ctx, "leaderboard", int64(start), int64(stop)).Result()
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get leaderboard: %w", err)
	}

	entries := make([]models.LeaderboardEntry, len(results))

	for i, z := range results {
		entries[i] = models.LeaderboardEntry{
			Username: z.Member.(string),
			Rating:   int(z.Score),
			Rank:     0, // Placeholder, calculated in Handler
		}
	}

	return entries, total, nil
}

// SearchUsers - UPDATED: Sorts by Rating DESC to satisfy Matiks requirement
func (s *LeaderboardService) SearchUsers(ctx context.Context, query string, limit, offset int) ([]models.SearchResult, error) {
	// 1. Search PostgreSQL
	// CHANGE: We ORDER BY rating DESC so that higher scores (Rank 1) appear first
	rows, err := s.db.QueryContext(ctx, `
		SELECT username, rating 
		FROM users 
		WHERE username ILIKE $1 
		ORDER BY rating DESC, username ASC
		LIMIT $2 OFFSET $3
	`, query+"%", limit, offset)

	if err != nil {
		return nil, fmt.Errorf("failed to search users: %w", err)
	}
	defer rows.Close()

	// 2. Collect all users first
	type tempUser struct {
		Username string
		Rating   int
	}
	var users []tempUser

	for rows.Next() {
		var u tempUser
		if err := rows.Scan(&u.Username, &u.Rating); err == nil {
			users = append(users, u)
		}
	}

	if len(users) == 0 {
		return []models.SearchResult{}, nil
	}

	// 3. PIPELINE: Queue up all Rank calculations
	pipe := s.redis.Pipeline()
	rankCmds := make([]*redis.IntCmd, len(users))

	for i, u := range users {
		// Tie-Aware Logic: Count people strictly better than this rating
		rankCmds[i] = pipe.ZCount(ctx, "leaderboard", fmt.Sprintf("(%d", u.Rating), "+inf")
	}

	// 4. EXECUTE: Fire the batch
	if _, err := pipe.Exec(ctx); err != nil {
		return nil, fmt.Errorf("failed to execute pipeline: %w", err)
	}

	// 5. MAP results back
	results := make([]models.SearchResult, len(users))
	for i, u := range users {
		// Rank = (Count of people with > rating) + 1
		// This ensures two users with same rating get the same rank
		rank := rankCmds[i].Val() + 1

		results[i] = models.SearchResult{
			GlobalRank: int(rank),
			Username:   u.Username,
			Rating:     u.Rating,
		}
	}

	return results, nil
}
func (s *LeaderboardService) GetUserRank(ctx context.Context, username string) (*models.SearchResult, error) {
	// Get rating from Redis
	score := s.redis.ZScore(ctx, "leaderboard", username).Val()
	rating := int(score)

	if rating == 0 {
		return nil, fmt.Errorf("user not found")
	}

	rank := s.calculateRank(ctx, username, rating)

	return &models.SearchResult{
		GlobalRank: rank,
		Username:   username,
		Rating:     rating,
	}, nil
}

// UpdateRating updates a user's rating in both Postgres and Redis
func (s *LeaderboardService) UpdateRating(ctx context.Context, username string, newRating int) error {
	// Validate rating
	if newRating < 100 || newRating > 5000 {
		return fmt.Errorf("rating must be between 100 and 5000")
	}

	// Update PostgreSQL (Source of Truth)
	_, err := s.db.ExecContext(ctx, `
		UPDATE users 
		SET rating = $1, updated_at = NOW() 
		WHERE username = $2
	`, newRating, username)

	if err != nil {
		return fmt.Errorf("failed to update postgres: %w", err)
	}

	// Update Redis (Live Cache)
	if err := s.redis.ZAdd(ctx, "leaderboard", redis.Z{
		Score:  float64(newRating),
		Member: username,
	}).Err(); err != nil {
		return fmt.Errorf("failed to update redis: %w", err)
	}

	return nil
}


func (s *LeaderboardService) calculateRank(ctx context.Context, username string, rating int) int {

	count := s.redis.ZCount(ctx, "leaderboard", fmt.Sprintf("(%d", rating), "+inf").Val()

	return int(count) + 1
}

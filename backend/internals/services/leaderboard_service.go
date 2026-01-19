package services
import(
	"fmt"
	"database/sql"
	"context"
	"sync"

	"github.com/redis/go-redis/v9"
	"matiks-leaderboard/internals/models"

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

func (s *LeaderboardService) GetLeaderboard(ctx context.Context, page, limit int) ([]models.LeaderboardEntry, int64, error) {
	start := (page - 1) * limit
	end := start + limit - 1

	// Get total count
	total := s.redis.ZCard(ctx, "leaderboard").Val()

	// Get users from Redis (sorted by rating DESC)
	results, err := s.redis.ZRevRangeWithScores(ctx, "leaderboard", int64(start), int64(end)).Result()
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get leaderboard: %w", err)
	}

	entries := make([]models.LeaderboardEntry, 0, len(results))
	
	for _, z := range results {
		rank := s.calculateRank(ctx, z.Member.(string), int(z.Score))
		entries = append(entries, models.LeaderboardEntry{
			Rank:     rank,
			Username: z.Member.(string),
			Rating:   int(z.Score),
		})
	}

	return entries, total, nil
}

// SearchUsers searches for users by username prefix
func (s *LeaderboardService) SearchUsers(ctx context.Context, query string) ([]models.SearchResult, error) {
	// Search in PostgreSQL for username matches
	rows, err := s.db.QueryContext(ctx, `
		SELECT username, rating 
		FROM users 
		WHERE username ILIKE $1 
		LIMIT 20
	`, query+"%")
	
	if err != nil {
		return nil, fmt.Errorf("failed to search users: %w", err)
	}
	defer rows.Close()

	results := make([]models.SearchResult, 0)
	
	for rows.Next() {
		var username string
		var rating int
		
		if err := rows.Scan(&username, &rating); err != nil {
			continue
		}

		// Get rank from Redis
		rank := s.calculateRank(ctx, username, rating)
		
		results = append(results, models.SearchResult{
			GlobalRank: rank,
			Username:   username,
			Rating:     rating,
		})
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

// UpdateRating updates a user's rating
func (s *LeaderboardService) UpdateRating(ctx context.Context, username string, newRating int) error {
	// Validate rating
	if newRating < 100 || newRating > 5000 {
		return fmt.Errorf("rating must be between 100 and 5000")
	}

	// Update PostgreSQL
	_, err := s.db.ExecContext(ctx, `
		UPDATE users 
		SET rating = $1, updated_at = NOW() 
		WHERE username = $2
	`, newRating, username)
	
	if err != nil {
		return fmt.Errorf("failed to update postgres: %w", err)
	}

	// Update Redis
	if err := s.redis.ZAdd(ctx, "leaderboard", redis.Z{
		Score:  float64(newRating),
		Member: username,
	}).Err(); err != nil {
		return fmt.Errorf("failed to update redis: %w", err)
	}

	return nil
}

// calculateRank calculates the correct rank handling ties
func (s *LeaderboardService) calculateRank(ctx context.Context, username string, rating int) int {
	// // Get reverse rank (0-indexed position)
	// revRank := s.redis.ZRevRank(ctx, "leaderboard", username).Val()
	
	// Count users with higher rating
	count := s.redis.ZCount(ctx, "leaderboard", fmt.Sprintf("(%d", rating), "+inf").Val()
	
	// Rank is count + 1 (1-indexed)
	return int(count) + 1
}
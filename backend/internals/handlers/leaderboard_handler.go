package handlers

import (
	"net/http"
	"strconv"

	"matiks-leaderboard/internals/services"

	"github.com/gin-gonic/gin"
)

type LeaderboardHandler struct {
	service *services.LeaderboardService
}

func NewLeaderboardHandler(service *services.LeaderboardService) *LeaderboardHandler {
	return &LeaderboardHandler{service: service}
}

// GetLeaderboard - OPTIMIZED: Calculates ranks in memory to avoid N+1 Redis calls
// @Summary Get leaderboard
// @Tags leaderboard
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(100)
// @Success 200 {object} map[string]interface{}
// @Router /api/leaderboard [get]
func (h *LeaderboardHandler) GetLeaderboard(c *gin.Context) {
	// 1. Parse Pagination
	pageStr := c.DefaultQuery("page", "1")
	limitStr := c.DefaultQuery("limit", "100")

	page, _ := strconv.Atoi(pageStr)
	limit, _ := strconv.Atoi(limitStr)

	// Validate inputs
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 100
	}
	if limit > 500 {
		limit = 500
	} // Cap limit for safety

	// 2. Calculate Redis Range (ZREVRANGE is 0-indexed)
	start := int64((page - 1) * limit)
	stop := start + int64(limit) - 1

	// 3. FETCH DATA
	entries, total, err := h.service.GetLeaderboard(c.Request.Context(), int(start), int(stop))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 4. CALCULATE RANKS IN MEMORY
	type UserResponse struct {
		Rank     int64   `json:"rank"`
		Username string  `json:"username"`
		Rating   float64 `json:"rating"`
	}

	response := make([]UserResponse, len(entries))

	for i, entry := range entries {
		// Calculate the "Standard Rank" based on position
		currentPosition := start + int64(i)
		currentRank := currentPosition + 1

		// HANDLE TIES:
		// Convert entry.Rating (int) to float64 for comparison
		if i > 0 && float64(entry.Rating) == response[i-1].Rating {
			// Tied with previous user
			response[i] = UserResponse{
				Rank:     response[i-1].Rank,
				Username: entry.Username,
				Rating:   float64(entry.Rating),
			}
		} else {
			// New rank
			response[i] = UserResponse{
				Rank:     currentRank,
				Username: entry.Username,
				Rating:   float64(entry.Rating),
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  response,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// SearchUsers - OPTIMIZED: Supports Pagination
// @Summary Search users by username
// @Tags search
// @Param username query string true "Username to search"
// @Param page query int false "Page number" default(1)
// @Success 200 {object} map[string]interface{}
// @Router /api/search [get]
func (h *LeaderboardHandler) SearchUsers(c *gin.Context) {
	username := c.Query("username")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit := 50 // Fixed batch size for search

	if username == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username query parameter required"})
		return
	}
	if page < 1 {
		page = 1
	}

	// Calculate offset for SQL
	offset := (page - 1) * limit

	results, err := h.service.SearchUsers(c.Request.Context(), username, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": results,
		"page":    page,
	})
}

// GetUserRank godoc
// @Summary Get user rank
// @Tags users
// @Param username path string true "Username"
// @Success 200 {object} services.SearchResult
// @Router /api/users/{username}/rank [get]
func (h *LeaderboardHandler) GetUserRank(c *gin.Context) {
	username := c.Param("username")

	result, err := h.service.GetUserRank(c.Request.Context(), username)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, result)
}

// UpdateRating godoc
// @Summary Update user rating
// @Tags users
// @Param username path string true "Username"
// @Param body body map[string]int true "Rating"
// @Success 200 {object} map[string]interface{}
// @Router /api/users/{username}/rating [post]
func (h *LeaderboardHandler) UpdateRating(c *gin.Context) {
	username := c.Param("username")

	var body struct {
		Rating int `json:"rating" binding:"required,min=100,max=5000"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.UpdateRating(c.Request.Context(), username, body.Rating); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get new rank
	result, _ := h.service.GetUserRank(c.Request.Context(), username)

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"username": username,
		"rating":   body.Rating,
		"rank":     result.GlobalRank,
	})
}

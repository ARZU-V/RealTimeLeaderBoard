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

// GetLeaderboard godoc
// @Summary Get leaderboard
// @Tags leaderboard
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(100)
// @Success 200 {object} map[string]interface{}
// @Router /api/leaderboard [get]
func (h *LeaderboardHandler) GetLeaderboard(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))

	// Validate
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 100
	}

	entries, total, err := h.service.GetLeaderboard(c.Request.Context(), page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  entries,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// SearchUsers godoc
// @Summary Search users by username
// @Tags search
// @Param username query string true "Username to search"
// @Success 200 {object} map[string]interface{}
// @Router /api/search [get]
func (h *LeaderboardHandler) SearchUsers(c *gin.Context) {
	username := c.Query("username")

	if username == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username query parameter required"})
		return
	}

	results, err := h.service.SearchUsers(c.Request.Context(), username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": results,
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

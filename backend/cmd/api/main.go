package main

import (
	"log"
	"matiks-leaderboard/config"
	"matiks-leaderboard/internals/database"
	"matiks-leaderboard/internals/handlers"
	"matiks-leaderboard/internals/services"
	"matiks-leaderboard/internals/simulation"
	"os"
	"time"

	"github.com/gin-contrib/cors" // Ensure this is in go.mod
	"github.com/gin-gonic/gin"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Connect to databases
	pg, err := database.NewPostgresDB(cfg.DatabaseURL)
	if err != nil {
		log.Fatal("Failed to connect to PostgreSQL:", err)
	}
	defer pg.Close()

	rdb, err := database.NewRedisDB(cfg.RedisEndpoint)
	if err != nil {
		log.Fatal("Failed to connect to Redis:", err)
	}
	defer rdb.Close()

	// Initialize services
	leaderboardService := services.NewLeaderboardService(pg.DB, rdb.Client)

	// Initialize handlers
	leaderboardHandler := handlers.NewLeaderboardHandler(leaderboardService)
	simHandler := handlers.NewSimulationHandler()

	// Setup Gin Mode
	if os.Getenv("APP_ENV") == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// START BACKGROUND WORKER
	simulation.Start(pg.DB, leaderboardService)

	// Auto-start simulation if ENV is set
	if os.Getenv("ENABLE_SIMULATION") == "true" {
		simulation.SetState(true)
	}

	r := gin.Default()
	
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowAllOrigins = true 
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Accept", "Authorization"}
	corsConfig.MaxAge = 12 * time.Hour

	r.Use(cors.New(corsConfig))
	
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":    "healthy",
			"timestamp": time.Now().Unix(),
		})
	})

	// API routes
	api := r.Group("/api")
	{
		api.GET("/leaderboard", leaderboardHandler.GetLeaderboard)
		api.GET("/search", leaderboardHandler.SearchUsers)
		api.GET("/users/:username/rank", leaderboardHandler.GetUserRank)
		api.POST("/users/:username/rating", leaderboardHandler.UpdateRating)

		// Simulation Routes
		api.GET("/simulation/status", simHandler.GetStatus)
		api.POST("/simulation/toggle", simHandler.Toggle)
	}

	// Start server
	log.Printf("🚀 Server running on http://localhost:%s", cfg.Port)
	log.Printf("📊 Leaderboard API: http://localhost:%s/api/leaderboard", cfg.Port)

	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
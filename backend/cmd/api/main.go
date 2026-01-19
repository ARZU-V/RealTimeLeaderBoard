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

	"github.com/gin-contrib/cors"
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
	simHandler := handlers.NewSimulationHandler() // <--- 1. NEW: Init Sim Handler

	// Setup Gin
	if cfg.Port == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// 2. START BACKGROUND WORKER (Always run this so the toggle button works!)
	simulation.Start(pg.DB, leaderboardService)

	// Optional: Auto-start if ENV is set
	if os.Getenv("ENABLE_SIMULATION") == "true" {
		simulation.SetState(true)
	}

	r := gin.Default()

	// CORS middleware
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Health check
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

		// <--- 3. NEW: Register Simulation Routes
		api.GET("/simulation/status", simHandler.GetStatus)
		api.POST("/simulation/toggle", simHandler.Toggle)
	}

	// Start server
	log.Printf("🚀 Server running on http://localhost:%s", cfg.Port)
	log.Printf("📊 Leaderboard API: http://localhost:%s/api/leaderboard", cfg.Port)
	log.Printf("🔍 Search API: http://localhost:%s/api/search?username=swift", cfg.Port)

	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}

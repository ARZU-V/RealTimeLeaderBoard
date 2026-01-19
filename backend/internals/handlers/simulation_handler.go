package handlers

import (
	"matiks-leaderboard/internals/simulation"
	"net/http"
	"github.com/gin-gonic/gin"
)

type SimulationHandler struct{}

func NewSimulationHandler() *SimulationHandler {
	return &SimulationHandler{}
}

// GET /api/simulation/status
func (h *SimulationHandler) GetStatus(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"active": simulation.GetState()})
}

// POST /api/simulation/toggle
func (h *SimulationHandler) Toggle(c *gin.Context) {
	var req struct {
		Active bool `json:"active"`
	}
	// Bind JSON body to struct
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid body"})
		return
	}

	// Update the simulation state
	simulation.SetState(req.Active)

	c.JSON(http.StatusOK, gin.H{
		"active":  simulation.GetState(),
		"message": "Simulation state updated",
	})
}

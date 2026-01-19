package utils
import (
	"fmt"
	"math/rand"
	"time"
)

var first = []string{"Mathy", "NumberNinja", "CalcMaster", "Algebrator", "GeoGuru", "StatSage", "ProbPro", "MatrixMaestro", "FunctionFanatic", "DerivDynamo", "IntegralIcon", "TheoremTitan", "PiPioneer", "VectorVirtuoso", "LimitLegend", "SequenceSultan", "GraphGenius", "RatioRuler", "AngleAce", "SumSultan"}
var second = []string{"Solver", "Whiz", "Wiz", "Brain", "Genius", "Prodigy", "Ace", "Champion", "Hero", "Wizard", "Savant", "Maven", "Expert", "Conqueror", "Mastermind", "Virtuoso", "Maestro", "Strategist", "Tactician", "Thinker", "Pioneer", "Innovator", "Visionary", "Trailblazer", "Pathfinder", "Explorer"}

func init() {
	rand.Seed(time.Now().UnixNano())
}

func GenerateUsername(index int) string {
	adj := first[rand.Intn(len(first))]
	noun := second[rand.Intn(len(second))]
	return fmt.Sprintf("%s_%s_%d", adj, noun, index)
}

func GenerateRating() int {
	roll := rand.Float64()
	
	if roll < 0.70 {
		return 1000 + rand.Intn(1500)
	}
	
	if roll < 0.90 {
		return 2500 + rand.Intn(1500)
	}
	
	return 4000 + rand.Intn(1000)
}
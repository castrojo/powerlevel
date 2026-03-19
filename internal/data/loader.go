package data

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
)

// Load reads powerlevel-data.json from the given path.
func Load(path string) (*PowerlevelData, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", path, err)
	}
	defer f.Close()

	var d PowerlevelData
	if err := json.NewDecoder(f).Decode(&d); err != nil {
		return nil, fmt.Errorf("decode %s: %w", path, err)
	}
	return &d, nil
}

// ComputePL returns 100 + sum(all weapon levels) / 8.
// Calibrated for 55 weapons over a 2-3 year growth arc.
// Soft cap ~250, hard cap ~450, pinnacle ~650.
func ComputePL(weapons map[string]Weapon) int {
	sum := 0
	for _, w := range weapons {
		sum += w.Level
	}
	return 100 + sum/8
}

// Ranks maps PL thresholds to titles.
var Ranks = []struct {
	Threshold int
	Name      string
}{
	{100, "New Light"},
	{130, "Brave"},
	{160, "Seasoned"},
	{190, "Hardened"},
	{220, "Battle-Tested"},
	{250, "Veteran"},    // soft cap
	{300, "Forged"},
	{350, "Unbroken"},
	{400, "Ascendant"},
	{450, "Gilded"},     // hard cap
	{650, "Mastercrafted ★"}, // pinnacle
}

// GetRank returns the rank title for a given PL.
func GetRank(pl int) string {
	rank := "New Light"
	for _, r := range Ranks {
		if pl >= r.Threshold {
			rank = r.Name
		}
	}
	return rank
}

// SubclassAvg returns the average weapon level for a given element.
func SubclassAvg(element string, weapons map[string]Weapon) int {
	sum, count := 0, 0
	for _, w := range weapons {
		if w.Element == element {
			sum += w.Level
			count++
		}
	}
	if count == 0 {
		return 0
	}
	return sum / count
}

// StatScale converts a raw count to a 0-100 score using a log curve.
// softCap → score 67, pinnacle → score 100.
func StatScale(raw, softCap int) int {
	if raw <= 0 {
		return 0
	}
	score := 67 * math.Log(1+float64(raw)) / math.Log(1+float64(softCap))
	return min(100, int(math.Round(score)))
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// LevelTier returns the tier title for a weapon level.
func LevelTier(level int) string {
	switch {
	case level == 0:
		return "Unequipped"
	case level < 10:
		return "New Light"
	case level < 20:
		return "Brave"
	case level < 30:
		return "Seasoned"
	case level < 40:
		return "Hardened"
	case level < 50:
		return "Battle-Tested"
	case level < 60:
		return "Veteran"
	case level < 70:
		return "Forged"
	case level < 80:
		return "Unbroken"
	case level < 90:
		return "Ascendant"
	case level < 100:
		return "Gilded"
	default:
		return "Mastercrafted ★"
	}
}

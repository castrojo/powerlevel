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

// ComputePL returns round(mean(weapon levels)).
// Calibrated for 1-100 range.
func ComputePL(weapons map[string]Weapon) int {
	if len(weapons) == 0 {
		return 1
	}
	sum := 0
	for _, w := range weapons {
		sum += w.Level
	}
	return int(math.Round(float64(sum) / float64(len(weapons))))
}

// Ranks maps PL thresholds to titles.
var Ranks = []struct {
	Threshold int
	Name      string
}{
	{1, "New Light"},
	{10, "Brave"},
	{20, "Seasoned"},
	{30, "Hardened"},
	{40, "Battle-Tested"},
	{50, "Veteran"},
	{60, "Forged"},
	{70, "Unbroken"},
	{80, "Ascendant"},
	{90, "Gilded"},
	{100, "Mastercrafted ★"},
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

// StatScale converts a raw count to a 0-100 score.
// Linear to 75 at softCap, log curve from 75 to 100 between softCap and pinnacle.
func StatScale(raw, softCap, pinnacle int) int {
	if raw <= 0 {
		return 0
	}
	if raw >= pinnacle {
		return 100
	}
	if raw <= softCap {
		return int(math.Round(float64(raw) / float64(softCap) * 75))
	}
	t := float64(raw-softCap) / float64(pinnacle-softCap)
	return int(math.Round(75 + 25*math.Log(1+t*(math.E-1))))
}

// LevelTier returns the tier title for a weapon level (minimum 1).
func LevelTier(level int) string {
	switch {
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

// Package exporter builds the sanitized ExportedData payload from source data
// and a pre-computed Stats block. It is kept thin deliberately — all the heavy
// lifting (PL formula, rank lookup, stat scaling) lives in internal/data.
package exporter

import (
	"time"

	"github.com/castrojo/powerlevel/internal/data"
)

// Build assembles an ExportedData ready to be marshalled to JSON.
// The caller is responsible for computing stats (e.g. from a session store).
func Build(pl *data.PowerlevelData, stats data.Stats) data.ExportedData {
	plScore := data.ComputePL(pl.Weapons)
	rank := data.GetRank(plScore)

	activeSupers := topTwoElements(pl.Weapons)

	return data.ExportedData{
		Season:       pl.Season,
		Weapons:      pl.Weapons,
		Stats:        stats,
		PowerLevel:   plScore,
		Rank:         rank,
		ActiveSupers: activeSupers,
		ExportedAt:   time.Now().UTC().Format(time.RFC3339),
	}
}

// topTwoElements returns the two element names with the highest average weapon
// level, in descending order.
func topTwoElements(weapons map[string]data.Weapon) []string {
	elems := []string{"arc", "solar", "void", "strand", "stasis"}

	type elemScore struct {
		elem string
		avg  int
	}
	scores := make([]elemScore, len(elems))
	for i, e := range elems {
		scores[i] = elemScore{e, data.SubclassAvg(e, weapons)}
	}

	// Simple selection sort — only 5 elements, O(n²) is fine.
	for i := range scores {
		for j := i + 1; j < len(scores); j++ {
			if scores[j].avg > scores[i].avg {
				scores[i], scores[j] = scores[j], scores[i]
			}
		}
	}

	return []string{scores[0].elem, scores[1].elem}
}

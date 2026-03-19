// cmd/exporter/main.go generates src/data/powerlevel.json from data/powerlevel-data.json.
// Run via: go run ./cmd/exporter/  (or: just export)
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/castrojo/powerlevel/internal/data"
	"github.com/castrojo/powerlevel/internal/exporter"
)

func main() {
	home, err := os.UserHomeDir()
	if err != nil {
		fmt.Fprintf(os.Stderr, "exporter: homedir: %v\n", err)
		os.Exit(1)
	}

	dataPath := filepath.Join(home, "src", "powerlevel", "data", "powerlevel-data.json")
	outPath := filepath.Join(home, "src", "powerlevel", "src", "data", "powerlevel.json")

	pl, err := data.Load(dataPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "exporter: load: %v\n", err)
		os.Exit(1)
	}

	stats := computeStats()
	exported := exporter.Build(pl, stats)

	out, err := json.MarshalIndent(exported, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "exporter: marshal: %v\n", err)
		os.Exit(1)
	}

	if err := os.MkdirAll(filepath.Dir(outPath), 0755); err != nil {
		fmt.Fprintf(os.Stderr, "exporter: mkdir: %v\n", err)
		os.Exit(1)
	}

	if err := os.WriteFile(outPath, out, 0644); err != nil {
		fmt.Fprintf(os.Stderr, "exporter: write: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("✓ exported PL=%d rank=%s to %s\n", exported.PowerLevel, exported.Rank, outPath)
}

// statEntry builds a Stat with a log-scaled score.
func statEntry(name string, raw, softCap, pinnacle int, unit string) data.Stat {
	return data.Stat{
		Name:     name,
		Raw:      raw,
		Score:    data.StatScale(raw, softCap),
		Label:    fmt.Sprintf("%d %s", raw, unit),
		SoftCap:  softCap,
		Pinnacle: pinnacle,
	}
}

// computeStats returns session stats.
// In CI (no local session store) this returns the hardcoded Day 1 baseline.
// Run `just export` locally to regenerate from the real session_store.
func computeStats() data.Stats {
	// Hardcoded Day 1 baseline — values from real session_store as of 2026-03-19.
	// Update these by running `just export` after each major milestone.
	return data.Stats{
		Endurance: statEntry("ENDURANCE", 11, 200, 1000, "sessions"),
		Synthesis: statEntry("SYNTHESIS", 6, 50, 500, "entries"),
		Breadth:   statEntry("BREADTH", 3, 20, 100, "repos"),
		Foresight: statEntry("FORESIGHT", 6, 50, 300, "checkpoints"),
		Output:    statEntry("OUTPUT", 24, 100, 500, "commits"),
		Recall:    statEntry("RECALL", 108, 200, 1000, "turns"),
	}
}

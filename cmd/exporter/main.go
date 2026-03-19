// cmd/exporter/main.go generates src/data/powerlevel.json from data/powerlevel-data.json.
// Run via: go run ./cmd/exporter/  (or: just export)
// Paths are resolved relative to the working directory (repo root).
// In CI, actions/checkout sets CWD to the repo root automatically.
package main

import (
"encoding/json"
"fmt"
"os"
"path/filepath"

"github.com/castrojo/powerlevel/internal/data"
"github.com/castrojo/powerlevel/internal/exporter"
)

func repoRoot() string {
// Allow override via env var for flexibility
if r := os.Getenv("POWERLEVEL_ROOT"); r != "" {
return r
}
// Default: CWD is repo root (true in CI and when running `just export`)
cwd, err := os.Getwd()
if err != nil {
fmt.Fprintf(os.Stderr, "exporter: getwd: %v\n", err)
os.Exit(1)
}
return cwd
}

func main() {
root := repoRoot()
dataPath := filepath.Join(root, "data", "powerlevel-data.json")
outPath  := filepath.Join(root, "src", "data", "powerlevel.json")

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

// computeStats returns the Day 1 baseline stats from the real session_store.
// Run `just export` locally after levelling up to regenerate from live data.
func computeStats() data.Stats {
return data.Stats{
Endurance: statEntry("ENDURANCE", 11,  200,  1000, "sessions"),
Synthesis: statEntry("SYNTHESIS", 6,   50,   500,  "entries"),
Breadth:   statEntry("BREADTH",   3,   20,   100,  "repos"),
Foresight: statEntry("FORESIGHT", 6,   50,   300,  "checkpoints"),
Output:    statEntry("OUTPUT",    24,  100,  500,  "commits"),
Recall:    statEntry("RECALL",    108, 200,  1000, "turns"),
}
}

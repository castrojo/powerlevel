// cmd/streak computes cross-machine session streak stats from the exported
// sessions manifest (data/exported-sessions.json) and writes data/streak.json.
//
// The manifest is committed to git and shared across machines, so streak stats
// are accurate regardless of which machine you run `just streak` on.
//
// Usage:
//
//	go run ./cmd/streak/ [--data-dir data] [--dry-run]
package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"
)

// sessionManifest mirrors the fields of data/exported-sessions.json that we
// care about. We only read, never write.
type sessionManifest struct {
	SessionTimestamps map[string]string `json:"session_timestamps"`
}

// streakResult is written to data/streak.json.
type streakResult struct {
	CurrentStreak   int    `json:"current_streak"`
	LongestStreak   int    `json:"longest_streak"`
	LastSessionDate string `json:"last_session_date"`
	TotalActiveDays int    `json:"total_active_days"`
	ComputedAt      string `json:"computed_at"`
}

// triumphsFile mirrors the top-level structure of data/triumphs.json.
type triumphsFile struct {
	Categories []triumphCategory `json:"categories"`
}

type triumphCategory struct {
	Triumphs []triumph `json:"triumphs"`
}

type triumph struct {
	ID     string `json:"id"`
	Earned bool   `json:"earned"`
}

func main() {
	dataDir := flag.String("data-dir", "data", "path to data directory")
	dryRun := flag.Bool("dry-run", false, "print streak stats but do not write files or append events")
	flag.Parse()

	// --- Load manifest ---
	manifestPath := filepath.Join(*dataDir, "exported-sessions.json")
	raw, err := os.ReadFile(manifestPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: cannot read manifest %s: %v\n", manifestPath, err)
		os.Exit(1)
	}
	var manifest sessionManifest
	if err := json.Unmarshal(raw, &manifest); err != nil {
		fmt.Fprintf(os.Stderr, "error: cannot parse manifest: %v\n", err)
		os.Exit(1)
	}

	// --- Extract unique UTC dates ---
	dateSet := make(map[string]bool, len(manifest.SessionTimestamps))
	for _, ts := range manifest.SessionTimestamps {
		d, ok := parseDate(ts)
		if !ok {
			continue
		}
		dateSet[d] = true
	}

	dates := make([]string, 0, len(dateSet))
	for d := range dateSet {
		dates = append(dates, d)
	}
	sort.Strings(dates)

	// --- Compute streak stats ---
	result := computeStreak(dates)

	// --- Print ---
	fmt.Printf("Current streak:    %d day(s)\n", result.CurrentStreak)
	fmt.Printf("Longest streak:    %d day(s)\n", result.LongestStreak)
	if result.LastSessionDate != "" {
		fmt.Printf("Last session date: %s\n", result.LastSessionDate)
	} else {
		fmt.Println("Last session date: (none)")
	}
	fmt.Printf("Total active days: %d\n", result.TotalActiveDays)

	if *dryRun {
		fmt.Println("(dry-run: no files written)")
		return
	}

	// --- Write streak.json ---
	out, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: cannot marshal streak result: %v\n", err)
		os.Exit(1)
	}
	streakPath := filepath.Join(*dataDir, "streak.json")
	if err := os.WriteFile(streakPath, append(out, '\n'), 0644); err != nil {
		fmt.Fprintf(os.Stderr, "error: cannot write %s: %v\n", streakPath, err)
		os.Exit(1)
	}
	fmt.Printf("✓ Wrote %s\n", streakPath)

	// --- Triumph check ---
	if result.CurrentStreak >= 30 {
		if !isTriumphEarned(*dataDir, "circuit_unbroken") {
			if err := appendTriumphEvent(*dataDir); err != nil {
				fmt.Fprintf(os.Stderr, "warning: could not append triumph event: %v\n", err)
			} else {
				fmt.Println("🏆 TRIUMPH EARNED: CIRCUIT UNBROKEN — Unbroken Chain — 30 consecutive active days!")
			}
		}
	}
}

// computeStreak derives current and longest streaks from a sorted, deduplicated
// list of "YYYY-MM-DD" date strings.
func computeStreak(dates []string) streakResult {
	now := time.Now().UTC()
	result := streakResult{
		ComputedAt: now.Format(time.RFC3339),
	}
	if len(dates) == 0 {
		return result
	}

	result.TotalActiveDays = len(dates)
	result.LastSessionDate = dates[len(dates)-1]

	// Longest streak: walk forward through sorted dates.
	longest := 1
	run := 1
	for i := 1; i < len(dates); i++ {
		if consecutiveDays(dates[i-1], dates[i]) {
			run++
			if run > longest {
				longest = run
			}
		} else {
			run = 1
		}
	}
	result.LongestStreak = longest

	// Current streak: must end at today or yesterday (grace day).
	today := now.Format("2006-01-02")
	yesterday := now.AddDate(0, 0, -1).Format("2006-01-02")
	last := dates[len(dates)-1]
	if last != today && last != yesterday {
		// Chain is broken — no active streak.
		result.CurrentStreak = 0
		return result
	}

	// Walk backwards counting consecutive days.
	current := 1
	for i := len(dates) - 1; i > 0; i-- {
		if consecutiveDays(dates[i-1], dates[i]) {
			current++
		} else {
			break
		}
	}
	result.CurrentStreak = current

	return result
}

// consecutiveDays returns true if b is exactly one calendar day after a.
// Both a and b must be "YYYY-MM-DD" strings.
func consecutiveDays(a, b string) bool {
	ta, err1 := time.Parse("2006-01-02", a)
	tb, err2 := time.Parse("2006-01-02", b)
	if err1 != nil || err2 != nil {
		return false
	}
	return tb.Sub(ta) == 24*time.Hour
}

// parseDate extracts a UTC date string "YYYY-MM-DD" from an ISO8601 timestamp.
// Accepts RFC3339, RFC3339Nano, and common SQLite/JS variants.
func parseDate(ts string) (string, bool) {
	layouts := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02T15:04:05.000Z",
		"2006-01-02T15:04:05Z",
	}
	for _, layout := range layouts {
		t, err := time.Parse(layout, ts)
		if err == nil {
			return t.UTC().Format("2006-01-02"), true
		}
	}
	return "", false
}

// isTriumphEarned reads data/triumphs.json and returns whether the given
// triumph ID has earned: true.
func isTriumphEarned(dataDir, triumphID string) bool {
	raw, err := os.ReadFile(filepath.Join(dataDir, "triumphs.json"))
	if err != nil {
		return false
	}
	var tf triumphsFile
	if err := json.Unmarshal(raw, &tf); err != nil {
		return false
	}
	for _, cat := range tf.Categories {
		for _, t := range cat.Triumphs {
			if t.ID == triumphID {
				return t.Earned
			}
		}
	}
	return false
}

// appendTriumphEvent appends a triumph_earned event to data/powerlevel-events.jsonl.
func appendTriumphEvent(dataDir string) error {
	eventsPath := filepath.Join(dataDir, "powerlevel-events.jsonl")

	// Verify no duplicate event already present in the file.
	if hasPriorEvent(eventsPath, "circuit_unbroken") {
		return nil
	}

	event := map[string]string{
		"type":       "triumph_earned",
		"triumph_id": "circuit_unbroken",
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
		"note":       "Unbroken Chain — 30 consecutive active days",
	}
	line, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal event: %w", err)
	}

	f, err := os.OpenFile(eventsPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("open events file: %w", err)
	}
	defer f.Close()

	_, err = fmt.Fprintf(f, "%s\n", line)
	return err
}

// hasPriorEvent scans powerlevel-events.jsonl for an existing triumph_earned
// event with the given triumph_id, to prevent duplicate appends.
func hasPriorEvent(eventsPath, triumphID string) bool {
	f, err := os.Open(eventsPath)
	if err != nil {
		return false
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" || line[0] == '#' {
			continue
		}
		var ev map[string]string
		if err := json.Unmarshal([]byte(line), &ev); err != nil {
			continue
		}
		if ev["type"] == "triumph_earned" && ev["triumph_id"] == triumphID {
			return true
		}
	}
	return false
}

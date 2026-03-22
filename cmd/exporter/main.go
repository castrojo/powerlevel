package main

import (
	"bufio"
	"database/sql"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// SessionManifest tracks which sessions have been counted into stats.
// Committed to git — makes stats cumulative across machines forever.
type SessionManifest struct {
	SessionIDs             []string          `json:"session_ids"`
	Repos                  []string          `json:"repos"`
	FeedSessionIDs         []string          `json:"feed_session_ids"`
	ModelLogProcessedLines int               `json:"model_log_processed_lines"`
	// SessionTimestamps maps session ID → created_at (UTC ISO8601).
	// Used by cmd/streak to compute cross-machine day-streak stats.
	SessionTimestamps      map[string]string `json:"session_timestamps,omitempty"`
	UpdatedAt              string            `json:"updated_at"`
}

// sessionRow holds a session ID and its created_at timestamp from the DB.
type sessionRow struct {
	ID        string
	CreatedAt string
}

func loadManifest(dataDir string) SessionManifest {
	path := filepath.Join(dataDir, "exported-sessions.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		return SessionManifest{}
	}
	var m SessionManifest
	if err := json.Unmarshal(raw, &m); err != nil {
		return SessionManifest{}
	}
	return m
}

func saveManifest(path string, m *SessionManifest) error {
	m.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	b, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal manifest: %w", err)
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0644); err != nil {
		return fmt.Errorf("write manifest tmp: %w", err)
	}
	return os.Rename(tmp, path)
}

func toSet(ids []string) map[string]bool {
	s := make(map[string]bool, len(ids))
	for _, id := range ids {
		s[id] = true
	}
	return s
}

// FeedEntry represents one session in the activity feed.

type FeedEntry struct {
	ID         string   `json:"id"`
	Repository string   `json:"repository"`
	Branch     string   `json:"branch"`
	Summary    string   `json:"summary"`
	CreatedAt  string   `json:"created_at"`
	Turns      int      `json:"turns"`
	PRs        []string `json:"prs"`
	XP         int      `json:"xp"`
	Tags       []string `json:"tags"`
}

// StatBlock mirrors the shape stored in powerlevel-data.json.
// RepoNames is internal-only (never written to JSON) — used to pass repo names
// for breadth calculation during delta computation.
type StatBlock struct {
	Raw        int      `json:"raw"`
	SoftCap    int      `json:"softCap"`
	Pinnacle   int      `json:"pinnacle"`
	Unit       string   `json:"unit"`
	History    []int    `json:"history"`
	ExportedAt string   `json:"exported_at"`
	RepoNames  []string `json:"-"` // internal: repo names for breadth, not written to JSON
}

func main() {
	sessionDB := flag.String("session-store", filepath.Join(os.Getenv("HOME"), ".copilot", "session-store.db"), "path to session-store.db")
	dataDir := flag.String("data-dir", "data", "path to data directory")
	flag.Parse()

	db, err := sql.Open("sqlite3", *sessionDB+"?mode=ro")
	if err != nil {
		log.Fatalf("failed to open session store: %v", err)
	}
	defer db.Close()

	manifest := loadManifest(*dataDir)
	counted := toSet(manifest.SessionIDs)
	feedCounted := toSet(manifest.FeedSessionIDs)

	manifestPath := filepath.Join(*dataDir, "exported-sessions.json")

	// Collect new sessions not yet counted into stats.
	newSessions := queryNewSessions(db, counted)
	if len(newSessions) == 0 {
		fmt.Println("✓ No new sessions to export — stats already current")
	} else {
		fmt.Printf("→ %d new session(s) to export\n", len(newSessions))

		delta := computeDeltaStats(db, newSessions)
		mergedStats := mergeStats(*dataDir, delta, &manifest)

		manifest.SessionIDs = append(manifest.SessionIDs, newSessions...)

		// Save manifest BEFORE patching stats so an interrupted run doesn't
		// double-count sessions on the next execution.
		if err := saveManifest(manifestPath, &manifest); err != nil {
			log.Fatalf("save manifest: %v", err)
		}

		patchStats(*dataDir, mergedStats)

		fmt.Printf("✓ Stats: endurance=%d recall=%d breadth=%d foresight=%d output=%d\n",
			mergedStats["endurance"].Raw, mergedStats["recall"].Raw,
			mergedStats["breadth"].Raw, mergedStats["foresight"].Raw,
			mergedStats["output"].Raw)
	}

	newFeedEntries := buildNewFeedEntries(db, feedCounted)
	if len(newFeedEntries) > 0 {
		merged := mergeFeed(*dataDir, newFeedEntries)
		writeFeed(*dataDir, merged)
		for _, e := range newFeedEntries {
			manifest.FeedSessionIDs = append(manifest.FeedSessionIDs, e.ID)
		}
		fmt.Printf("✓ Feed updated: %d new entr(ies) added\n", len(newFeedEntries))
	} else {
		fmt.Println("✓ Feed already current")
	}

	modelLog := filepath.Join(os.Getenv("HOME"), ".copilot", "model-log.jsonl")
	usage, newLines := buildIncrementalModelUsage(*dataDir, modelLog, manifest.ModelLogProcessedLines)
	if newLines > 0 {
		writeModelUsage(*dataDir, usage)
		manifest.ModelLogProcessedLines += newLines
		fmt.Printf("✓ Model usage: %d total dispatches across %d models (+%d new log lines)\n",
			usage.TotalDispatches, len(usage.ModelCounts), newLines)
	} else {
		fmt.Println("✓ Model usage already current")
	}

	if err := saveManifest(manifestPath, &manifest); err != nil {
		log.Fatalf("save manifest: %v", err)
	}
	fmt.Println("✓ Manifest saved — stats are cumulative across machines")
}

// queryNewSessions returns session IDs from the local DB not yet in the manifest.
func queryNewSessions(db *sql.DB, counted map[string]bool) []string {
	rows, err := db.Query("SELECT id FROM sessions ORDER BY created_at ASC")
	if err != nil {
		log.Fatalf("query sessions: %v", err)
	}
	defer rows.Close()
	var newIDs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			continue
		}
		if !counted[id] {
			newIDs = append(newIDs, id)
		}
	}
	return newIDs
}

// computeDeltaStats calculates stats for a specific set of session IDs only.
func computeDeltaStats(db *sql.DB, sessionIDs []string) map[string]StatBlock {
	now := time.Now().UTC().Format(time.RFC3339)
	delta := map[string]StatBlock{}

	// Build a placeholder string for SQL IN clause.
	placeholders := make([]string, len(sessionIDs))
	args := make([]interface{}, len(sessionIDs))
	for i, id := range sessionIDs {
		placeholders[i] = "?"
		args[i] = id
	}
	in := "(" + joinStrings(placeholders, ",") + ")"

	delta["endurance"] = StatBlock{Raw: len(sessionIDs), SoftCap: 200, Pinnacle: 1000, Unit: "sessions", ExportedAt: now}

	var recall int
	db.QueryRow("SELECT COUNT(*) FROM turns WHERE session_id IN "+in, args...).Scan(&recall)
	delta["recall"] = StatBlock{Raw: recall, SoftCap: 2000, Pinnacle: 10000, Unit: "turns", ExportedAt: now}

	rows, _ := db.Query("SELECT DISTINCT COALESCE(repository,'') FROM sessions WHERE id IN "+in+" AND repository IS NOT NULL AND repository != ''", args...)
	var newRepos []string
	if rows != nil {
		for rows.Next() {
			var r string
			if err := rows.Scan(&r); err != nil {
				continue
			}
			newRepos = append(newRepos, r)
		}
		rows.Close()
	}
	delta["breadth"] = StatBlock{Raw: 0, SoftCap: 20, Pinnacle: 100, Unit: "repos", ExportedAt: now, RepoNames: newRepos}

	var foresight int
	db.QueryRow("SELECT COUNT(*) FROM checkpoints WHERE session_id IN "+in, args...).Scan(&foresight)
	delta["foresight"] = StatBlock{Raw: foresight, SoftCap: 50, Pinnacle: 300, Unit: "checkpoints", ExportedAt: now}

	var output int
	db.QueryRow("SELECT COUNT(*) FROM session_refs WHERE session_id IN "+in+" AND ref_type IN ('commit','pr')", args...).Scan(&output)
	delta["output"] = StatBlock{Raw: output, SoftCap: 100, Pinnacle: 500, Unit: "commits", ExportedAt: now}

	var synthesis int
	db.QueryRow("SELECT COUNT(DISTINCT t.session_id) FROM turns t WHERE t.session_id IN "+in+" AND t.assistant_response LIKE '%knowledge-store%'", args...).Scan(&synthesis)
	delta["synthesis"] = StatBlock{Raw: synthesis, SoftCap: 50, Pinnacle: 500, Unit: "entries", ExportedAt: now}

	return delta
}

// mergeStats loads existing stats from powerlevel-data.json and adds delta on top.
// Breadth uses the manifest repo union for an accurate unique count.
func mergeStats(dataDir string, delta map[string]StatBlock, manifest *SessionManifest) map[string]StatBlock {
	path := filepath.Join(dataDir, "powerlevel-data.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		log.Fatalf("read powerlevel-data.json: %v", err)
	}
	var doc struct {
		Stats map[string]StatBlock `json:"stats"`
	}
	json.Unmarshal(raw, &doc)
	existing := doc.Stats
	if existing == nil {
		existing = map[string]StatBlock{}
	}

	result := map[string]StatBlock{}
	additive := []string{"endurance", "recall", "foresight", "output", "synthesis"}
	for _, key := range additive {
		d := delta[key]
		e := existing[key]
		result[key] = StatBlock{
			Raw:        e.Raw + d.Raw,
			SoftCap:    d.SoftCap,
			Pinnacle:   d.Pinnacle,
			Unit:       d.Unit,
			ExportedAt: d.ExportedAt,
		}
	}

	// Breadth: union of all repos seen across all machines.
	repoSet := toSet(manifest.Repos)
	for _, r := range delta["breadth"].RepoNames {
		if !repoSet[r] {
			manifest.Repos = append(manifest.Repos, r)
			repoSet[r] = true
		}
	}
	breadthRaw := len(manifest.Repos)
	if e, ok := existing["breadth"]; ok && e.Raw > breadthRaw {
		breadthRaw = e.Raw // never go below what the old machine committed
	}
	d := delta["breadth"]
	result["breadth"] = StatBlock{Raw: breadthRaw, SoftCap: d.SoftCap, Pinnacle: d.Pinnacle, Unit: d.Unit, ExportedAt: d.ExportedAt}

	return result
}

// patchStats writes only the stats section of powerlevel-data.json.
func patchStats(dataDir string, stats map[string]StatBlock) {
	path := filepath.Join(dataDir, "powerlevel-data.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		log.Fatalf("read powerlevel-data.json: %v", err)
	}

	var doc map[string]json.RawMessage
	if err := json.Unmarshal(raw, &doc); err != nil {
		log.Fatalf("parse powerlevel-data.json: %v", err)
	}

	statsJSON, err := json.Marshal(stats)
	if err != nil {
		log.Fatalf("marshal stats: %v", err)
	}
	doc["stats"] = json.RawMessage(statsJSON)

	out, err := json.MarshalIndent(doc, "", "  ")
	if err != nil {
		log.Fatalf("marshal doc: %v", err)
	}

	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, out, 0644); err != nil {
		log.Fatalf("write tmp: %v", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		log.Fatalf("rename: %v", err)
	}
	fmt.Println("✓ Patched powerlevel-data.json stats section")
}

// buildNewFeedEntries queries sessions not already in the feed.
func buildNewFeedEntries(db *sql.DB, feedCounted map[string]bool) []FeedEntry {
	rows, err := db.Query(`
		SELECT s.id, COALESCE(s.repository,''), COALESCE(s.branch,''),
		       COALESCE(s.summary,''), s.created_at
		FROM sessions s
		ORDER BY s.created_at DESC
	`)
	if err != nil {
		log.Printf("feed query: %v", err)
		return nil
	}
	defer rows.Close()

	var entries []FeedEntry
	for rows.Next() {
		var e FeedEntry
		if err := rows.Scan(&e.ID, &e.Repository, &e.Branch, &e.Summary, &e.CreatedAt); err != nil {
			continue
		}
		if feedCounted[e.ID] {
			continue
		}

		db.QueryRow("SELECT COUNT(*) FROM turns WHERE session_id = ?", e.ID).Scan(&e.Turns)

		prRows, _ := db.Query("SELECT ref_value FROM session_refs WHERE session_id = ? AND ref_type IN ('commit','pr') LIMIT 5", e.ID)
		if prRows != nil {
			for prRows.Next() {
				var ref string
				if err := prRows.Scan(&ref); err != nil {
					continue
				}
				e.PRs = append(e.PRs, ref)
			}
			prRows.Close()
		}

		e.XP = e.Turns*2 + len(e.PRs)*50
		e.Tags = []string{}
		e.Summary = truncateRunes(e.Summary, 200)
		if len([]rune(e.Summary)) == 200 {
			e.Summary += "…"
		}
		entries = append(entries, e)
	}
	return entries
}

// mergeFeed combines existing feed.json entries with new ones, sorted by date, capped at 20.
func mergeFeed(dataDir string, newEntries []FeedEntry) []FeedEntry {
	type FeedFile struct {
		Entries []FeedEntry `json:"entries"`
	}
	var existing FeedFile
	if raw, err := os.ReadFile(filepath.Join(dataDir, "feed.json")); err == nil {
		json.Unmarshal(raw, &existing)
	}

	all := append(existing.Entries, newEntries...)
	sort.Slice(all, func(i, j int) bool {
		return all[i].CreatedAt > all[j].CreatedAt
	})
	if len(all) > 20 {
		all = all[:20]
	}
	return all
}

func writeFeed(dataDir string, entries []FeedEntry) {
	type FeedFile struct {
		GeneratedAt string      `json:"generated_at"`
		Entries     []FeedEntry `json:"entries"`
	}
	feed := FeedFile{
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		Entries:     entries,
	}
	if feed.Entries == nil {
		feed.Entries = []FeedEntry{}
	}
	out, _ := json.MarshalIndent(feed, "", "  ")
	os.WriteFile(filepath.Join(dataDir, "feed.json"), out, 0644)
	fmt.Printf("✓ Wrote feed.json (%d entries)\n", len(entries))
}

// --- Model usage tracking ---

// ModelLogEntry is one line from ~/.copilot/model-log.jsonl.
type ModelLogEntry struct {
	Timestamp string   `json:"timestamp"`
	Task      string   `json:"task"`
	Models    []string `json:"models"`
}

// ModelUsage is the exported model-usage.json structure.
type ModelUsage struct {
	GeneratedAt     string                    `json:"generated_at"`
	TotalDispatches int                       `json:"total_dispatches"`
	ModelCounts     map[string]int            `json:"model_counts"`
	TaskCounts      map[string]int            `json:"task_counts"`
	ModelsByTask    map[string]map[string]int `json:"models_by_task"`
	TopModels       []ModelRank               `json:"top_models"`
	Recent          []ModelLogEntry           `json:"recent"`
}

// ModelRank is a model with its total dispatch count, sorted descending.
type ModelRank struct {
	Model string `json:"model"`
	Count int    `json:"count"`
}

// buildIncrementalModelUsage loads existing model-usage.json and appends only
// new lines from the log (beyond processedLines). Returns updated usage and count of new lines.
func buildIncrementalModelUsage(dataDir, logPath string, processedLines int) (ModelUsage, int) {
	// Load existing usage as baseline.
	usage := ModelUsage{
		ModelCounts:  map[string]int{},
		TaskCounts:   map[string]int{},
		ModelsByTask: map[string]map[string]int{},
		TopModels:    []ModelRank{},
		Recent:       []ModelLogEntry{},
	}
	if raw, err := os.ReadFile(filepath.Join(dataDir, "model-usage.json")); err == nil {
		json.Unmarshal(raw, &usage)
		if usage.ModelCounts == nil {
			usage.ModelCounts = map[string]int{}
		}
		if usage.TaskCounts == nil {
			usage.TaskCounts = map[string]int{}
		}
		if usage.ModelsByTask == nil {
			usage.ModelsByTask = map[string]map[string]int{}
		}
	}

	f, err := os.Open(logPath)
	if err != nil {
		return usage, 0
	}
	defer f.Close()

	var newEntries []ModelLogEntry
	lineNum := 0
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		lineNum++
		if lineNum <= processedLines || line == "" {
			continue
		}
		var entry ModelLogEntry
		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			continue
		}
		newEntries = append(newEntries, entry)

		usage.TotalDispatches++
		usage.TaskCounts[entry.Task]++
		if usage.ModelsByTask[entry.Task] == nil {
			usage.ModelsByTask[entry.Task] = map[string]int{}
		}
		for _, m := range entry.Models {
			usage.ModelCounts[m]++
			usage.ModelsByTask[entry.Task][m]++
		}
	}
	newLines := lineNum - processedLines

	// Rebuild top models from merged counts.
	usage.TopModels = nil
	for model, count := range usage.ModelCounts {
		usage.TopModels = append(usage.TopModels, ModelRank{Model: model, Count: count})
	}
	sort.Slice(usage.TopModels, func(i, j int) bool {
		return usage.TopModels[i].Count > usage.TopModels[j].Count
	})

	// Append new entries to recent list, keep last 10.
	usage.Recent = append(usage.Recent, newEntries...)
	if len(usage.Recent) > 10 {
		usage.Recent = usage.Recent[len(usage.Recent)-10:]
	}

	usage.GeneratedAt = time.Now().UTC().Format(time.RFC3339)
	if newLines < 0 {
		newLines = 0
	}
	return usage, newLines
}

func writeModelUsage(dataDir string, usage ModelUsage) {
	out, _ := json.MarshalIndent(usage, "", "  ")
	os.WriteFile(filepath.Join(dataDir, "model-usage.json"), out, 0644)
}

// truncateRunes truncates s to at most n Unicode code points.
// Safe for multi-byte characters (e.g., CJK, emoji).
func truncateRunes(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n])
}

func joinStrings(ss []string, sep string) string {
	result := ""
	for i, s := range ss {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}

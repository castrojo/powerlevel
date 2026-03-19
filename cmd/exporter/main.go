package main

import (
	"database/sql"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

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
type StatBlock struct {
	Raw        int    `json:"raw"`
	SoftCap    int    `json:"softCap"`
	Pinnacle   int    `json:"pinnacle"`
	Unit       string `json:"unit"`
	History    []int  `json:"history"`
	ExportedAt string `json:"exported_at"`
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

	stats := computeStats(db)
	patchStats(*dataDir, stats)

	feed := buildFeed(db)
	writeFeed(*dataDir, feed)

	fmt.Printf("✓ Exported: %d sessions, %d turns, %d repos, %d checkpoints, %d output\n",
		stats["endurance"].Raw, stats["recall"].Raw, stats["breadth"].Raw,
		stats["foresight"].Raw, stats["output"].Raw)
}

func computeStats(db *sql.DB) map[string]StatBlock {
	stats := map[string]StatBlock{}
	now := time.Now().UTC().Format(time.RFC3339)

	var endurance int
	db.QueryRow("SELECT COUNT(*) FROM sessions").Scan(&endurance)
	stats["endurance"] = StatBlock{Raw: endurance, SoftCap: 200, Pinnacle: 1000, Unit: "sessions", ExportedAt: now}

	var recall int
	db.QueryRow("SELECT COUNT(*) FROM turns").Scan(&recall)
	stats["recall"] = StatBlock{Raw: recall, SoftCap: 2000, Pinnacle: 10000, Unit: "turns", ExportedAt: now}

	var breadth int
	db.QueryRow("SELECT COUNT(DISTINCT repository) FROM sessions WHERE repository IS NOT NULL AND repository != ''").Scan(&breadth)
	stats["breadth"] = StatBlock{Raw: breadth, SoftCap: 20, Pinnacle: 100, Unit: "repos", ExportedAt: now}

	var foresight int
	db.QueryRow("SELECT COUNT(*) FROM checkpoints").Scan(&foresight)
	stats["foresight"] = StatBlock{Raw: foresight, SoftCap: 50, Pinnacle: 300, Unit: "checkpoints", ExportedAt: now}

	var output int
	db.QueryRow("SELECT COUNT(*) FROM session_refs WHERE ref_type IN ('commit', 'pr')").Scan(&output)
	stats["output"] = StatBlock{Raw: output, SoftCap: 100, Pinnacle: 500, Unit: "commits", ExportedAt: now}

	var synthesis int
	db.QueryRow(`SELECT COUNT(DISTINCT t.session_id) FROM turns t WHERE t.assistant_response LIKE '%knowledge-store%'`).Scan(&synthesis)
	if synthesis == 0 {
		db.QueryRow(`SELECT COUNT(*) FROM sessions WHERE summary LIKE '%knowledge-store%'`).Scan(&synthesis)
	}
	stats["synthesis"] = StatBlock{Raw: synthesis, SoftCap: 50, Pinnacle: 500, Unit: "entries", ExportedAt: now}

	return stats
}

// patchStats updates only the stats section of powerlevel-data.json using a
// JSON merge approach to preserve all other fields (e.g. aspect on weapons).
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

func buildFeed(db *sql.DB) []FeedEntry {
	rows, err := db.Query(`
		SELECT s.id, COALESCE(s.repository,''), COALESCE(s.branch,''),
		       COALESCE(s.summary,''), s.created_at
		FROM sessions s
		ORDER BY s.created_at DESC
		LIMIT 10
	`)
	if err != nil {
		log.Printf("feed query: %v", err)
		return nil
	}
	defer rows.Close()

	var entries []FeedEntry
	for rows.Next() {
		var e FeedEntry
		rows.Scan(&e.ID, &e.Repository, &e.Branch, &e.Summary, &e.CreatedAt)

		db.QueryRow("SELECT COUNT(*) FROM turns WHERE session_id = ?", e.ID).Scan(&e.Turns)

		prRows, _ := db.Query("SELECT ref_value FROM session_refs WHERE session_id = ? AND ref_type IN ('commit','pr') LIMIT 5", e.ID)
		if prRows != nil {
			for prRows.Next() {
				var ref string
				prRows.Scan(&ref)
				e.PRs = append(e.PRs, ref)
			}
			prRows.Close()
		}

		e.XP = e.Turns*2 + len(e.PRs)*50
		e.Tags = []string{}

		if len(e.Summary) > 200 {
			e.Summary = e.Summary[:200] + "…"
		}

		entries = append(entries, e)
	}
	return entries
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

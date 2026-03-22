// cmd/card generates a Destiny-themed SVG profile card at assets/profile-card.svg.
// Usage: go run ./cmd/card/ [--data-dir data/] [--output assets/profile-card.svg]
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// ── data types ────────────────────────────────────────────────────────────────

type weapon struct {
	Weapon  string `json:"weapon"`
	Element string `json:"element"`
	Level   int    `json:"level"`
}

type stat struct {
	Raw int `json:"raw"`
}

type stats struct {
	Endurance stat `json:"endurance"`
	Breadth   stat `json:"breadth"`
}

type season struct {
	Name string `json:"name"`
}

type powerlevelData struct {
	Season  season             `json:"season"`
	Weapons map[string]weapon  `json:"weapons"`
	Stats   stats              `json:"stats"`
}

type sealEntry struct {
	Earned bool `json:"earned"`
}

type sealsFile struct {
	Seals []sealEntry `json:"seals"`
}

// ── ranks ─────────────────────────────────────────────────────────────────────

var ranks = []struct {
	threshold int
	name      string
}{
	{100, "Mastercrafted ★"},
	{90, "Gilded"},
	{80, "Ascendant"},
	{70, "Unbroken"},
	{60, "Forged"},
	{50, "Veteran"},
	{40, "Battle-Tested"},
	{30, "Hardened"},
	{20, "Seasoned"},
	{10, "Brave"},
	{1, "New Light"},
}

func getRank(pl int) string {
	for _, r := range ranks {
		if pl >= r.threshold {
			return r.name
		}
	}
	return "New Light"
}

// ── element colors & icons ────────────────────────────────────────────────────

func elementColor(elem string) string {
	switch strings.ToLower(elem) {
	case "arc":
		return "#3fb6e6"
	case "solar":
		return "#f2831a"
	case "void":
		return "#8a5ab8"
	case "strand":
		return "#41c182"
	case "stasis":
		return "#6099d9"
	default:
		return "#58a6ff"
	}
}

func elementIcon(elem string) string {
	switch strings.ToLower(elem) {
	case "arc":
		return "⚡"
	case "solar":
		return "☀"
	case "void":
		return "◈"
	case "strand":
		return "∿"
	case "stasis":
		return "❄"
	default:
		return "◆"
	}
}

// ── helpers ───────────────────────────────────────────────────────────────────

func xmlEscape(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	return s
}

func truncate(s string, max int) string {
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	return string(runes[:max-1]) + "…"
}

func computePL(weapons map[string]weapon) int {
	if len(weapons) == 0 {
		return 1
	}
	sum := 0
	for _, w := range weapons {
		sum += w.Level
	}
	return int(math.Round(float64(sum) / float64(len(weapons))))
}

// ── SVG generation ────────────────────────────────────────────────────────────

func generateSVG(pd *powerlevelData, sealedCount int) string {
	pl := computePL(pd.Weapons)
	rank := getRank(pl)

	// Sort weapons by level descending, then name for stability.
	type weaponEntry struct {
		name    string
		element string
		level   int
	}
	var ws []weaponEntry
	for _, w := range pd.Weapons {
		ws = append(ws, weaponEntry{name: w.Weapon, element: w.Element, level: w.Level})
	}
	sort.Slice(ws, func(i, j int) bool {
		if ws[i].level != ws[j].level {
			return ws[i].level > ws[j].level
		}
		return ws[i].name < ws[j].name
	})
	if len(ws) > 3 {
		ws = ws[:3]
	}

	seasonName := xmlEscape(truncate(pd.Season.Name, 30))
	sessions := pd.Stats.Endurance.Raw
	activeRepos := pd.Stats.Breadth.Raw

	var b strings.Builder

	// SVG header
	b.WriteString(`<?xml version="1.0" encoding="UTF-8"?>`)
	b.WriteString("\n")
	b.WriteString(`<svg width="495" height="195" viewBox="0 0 495 195"`)
	b.WriteString(` xmlns="http://www.w3.org/2000/svg"`)
	b.WriteString(` role="img" aria-label="Powerlevel profile card">`)
	b.WriteString("\n")

	// Background rect
	b.WriteString(`  <rect width="495" height="195" rx="6" ry="6" fill="#0D1117" stroke="#30363d" stroke-width="1"/>`)
	b.WriteString("\n")

	// ── Header line ───────────────────────────────────────────────────────────
	// Diamond icon + PL number
	b.WriteString(fmt.Sprintf(
		`  <text x="20" y="28" font-family="'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace" font-size="14" fill="#58a6ff">◆</text>`,
	))
	b.WriteString("\n")
	b.WriteString(fmt.Sprintf(
		`  <text x="45" y="28" font-family="'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace" font-size="28" font-weight="bold" fill="#e6edf3">%d</text>`,
		pl,
	))
	b.WriteString("\n")
	// Rank title (after PL number — offset ~55px from x=45 for 1-2 digit numbers, use fixed offset)
	b.WriteString(fmt.Sprintf(
		`  <text x="85" y="28" font-family="'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace" font-size="13" fill="#8b949e">%s</text>`,
		xmlEscape(rank),
	))
	b.WriteString("\n")
	// Season name right-aligned
	b.WriteString(fmt.Sprintf(
		`  <text x="480" y="28" text-anchor="end" font-family="'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace" font-size="11" fill="#8b949e">%s</text>`,
		seasonName,
	))
	b.WriteString("\n")

	// ── Top divider ───────────────────────────────────────────────────────────
	b.WriteString(`  <line x1="20" y1="40" x2="475" y2="40" stroke="#30363d" stroke-width="1"/>`)
	b.WriteString("\n")

	// ── Weapon rows ───────────────────────────────────────────────────────────
	weaponYs := []int{65, 95, 125}
	barX := 200
	barWidth := 180
	barHeight := 6
	maxLevel := 100 // cap

	for i, w := range ws {
		y := weaponYs[i]
		color := elementColor(w.element)
		icon := elementIcon(w.element)
		name := xmlEscape(truncate(w.name, 22))

		// Element icon
		b.WriteString(fmt.Sprintf(
			`  <text x="20" y="%d" font-family="'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace" font-size="12" fill="%s">%s</text>`,
			y, color, icon,
		))
		b.WriteString("\n")

		// Weapon name
		b.WriteString(fmt.Sprintf(
			`  <text x="38" y="%d" font-family="'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace" font-size="12" fill="#e6edf3">%s</text>`,
			y, name,
		))
		b.WriteString("\n")

		// Level bar — background
		b.WriteString(fmt.Sprintf(
			`  <rect x="%d" y="%d" width="%d" height="%d" rx="3" ry="3" fill="#21262d"/>`,
			barX, y-barHeight, barWidth, barHeight,
		))
		b.WriteString("\n")

		// Level bar — fill
		level := w.level
		if level > maxLevel {
			level = maxLevel
		}
		fillW := int(math.Round(float64(level) / float64(maxLevel) * float64(barWidth)))
		if fillW > barWidth {
			fillW = barWidth
		}
		if fillW > 0 {
			b.WriteString(fmt.Sprintf(
				`  <rect x="%d" y="%d" width="%d" height="%d" rx="3" ry="3" fill="%s"/>`,
				barX, y-barHeight, fillW, barHeight, color,
			))
			b.WriteString("\n")
		}

		// Level number
		b.WriteString(fmt.Sprintf(
			`  <text x="390" y="%d" text-anchor="end" font-family="'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace" font-size="11" fill="#8b949e">%d</text>`,
			y, w.level,
		))
		b.WriteString("\n")
	}

	// ── Bottom divider ────────────────────────────────────────────────────────
	b.WriteString(`  <line x1="20" y1="150" x2="475" y2="150" stroke="#30363d" stroke-width="1"/>`)
	b.WriteString("\n")

	// ── Footer ────────────────────────────────────────────────────────────────
	footer := fmt.Sprintf("%d seals  ·  %d sessions  ·  %d repos", sealedCount, sessions, activeRepos)
	b.WriteString(fmt.Sprintf(
		`  <text x="20" y="175" font-family="'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace" font-size="11" fill="#8b949e">%s</text>`,
		xmlEscape(footer),
	))
	b.WriteString("\n")

	b.WriteString(`</svg>`)
	b.WriteString("\n")

	return b.String()
}

// ── main ──────────────────────────────────────────────────────────────────────

func main() {
	dataDir := flag.String("data-dir", "data/", "directory containing powerlevel-data.json and seals.json")
	output := flag.String("output", "assets/profile-card.svg", "output SVG path")
	flag.Parse()

	// Load powerlevel data.
	pdPath := filepath.Join(*dataDir, "powerlevel-data.json")
	pdBytes, err := os.ReadFile(pdPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: cannot read %s: %v\n", pdPath, err)
		os.Exit(1)
	}
	var pd powerlevelData
	if err := json.Unmarshal(pdBytes, &pd); err != nil {
		fmt.Fprintf(os.Stderr, "error: cannot parse %s: %v\n", pdPath, err)
		os.Exit(1)
	}

	// Load seals data.
	sealsPath := filepath.Join(*dataDir, "seals.json")
	sealsBytes, err := os.ReadFile(sealsPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: cannot read %s: %v\n", sealsPath, err)
		os.Exit(1)
	}
	var sf sealsFile
	if err := json.Unmarshal(sealsBytes, &sf); err != nil {
		fmt.Fprintf(os.Stderr, "error: cannot parse %s: %v\n", sealsPath, err)
		os.Exit(1)
	}

	// Count earned seals.
	sealedCount := 0
	for _, s := range sf.Seals {
		if s.Earned {
			sealedCount++
		}
	}

	// Generate SVG.
	svg := generateSVG(&pd, sealedCount)

	// Ensure output directory exists.
	if dir := filepath.Dir(*output); dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			fmt.Fprintf(os.Stderr, "error: cannot create directory %s: %v\n", dir, err)
			os.Exit(1)
		}
	}

	// Write SVG.
	if err := os.WriteFile(*output, []byte(svg), 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "error: cannot write %s: %v\n", *output, err)
		os.Exit(1)
	}

	fmt.Printf("Profile card written to %s\n", *output)
	fmt.Println("Embed in your profile README with:")
	fmt.Println("  ![Powerlevel](https://raw.githubusercontent.com/castrojo/powerlevel/main/assets/profile-card.svg)")
}

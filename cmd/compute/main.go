// cmd/compute — Sync weapon levels, triumph state, seals, and gilding.
//
// Replaces scripts/compute.py. Run from repo root. Exit 0 always.
// Writes changed=true/false to $GITHUB_OUTPUT.
//
// Input files:
//
//	data/skill-levels.json        — skill → level map (committed by agents)
//	data/powerlevel-data.json     — weapon definitions with current levels
//	data/powerlevel-events.jsonl  — append-only event log
//	data/triumphs.json            — triumph catalog with earned state
//	data/seals.json               — seal catalog with progress + gilding
package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/castrojo/powerlevel/internal/data"
)

func main() {
	changed := false

	// ── 1. Load skill levels ──────────────────────────────────────────────────
	skillLevels, err := loadSkillLevels("data/skill-levels.json")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading skill-levels.json: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Read %d skill levels from data/skill-levels.json\n", len(skillLevels))

	// ── 2. Update weapon levels + milestone tiers ─────────────────────────────
	weaponChanged, err := updateWeaponLevels("data/powerlevel-data.json", skillLevels)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error updating weapon levels: %v\n", err)
		os.Exit(1)
	}
	if weaponChanged {
		changed = true
	}

	// ── 3. Process events log → triumphs.json + collect seal_earned events ───
	earnedIDs, sealEarnedCounts, err := processEvents("data/powerlevel-events.jsonl")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error processing events: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Found %d earned triumph IDs in events log\n", len(earnedIDs))

	// ── 3b. Auto-earn triumphs whose stat_requirement is already met ─────────
	rawStats, statErr := loadStatRaws("data/powerlevel-data.json")
	if statErr != nil {
		fmt.Fprintf(os.Stderr, "Warning: cannot load stats for stat_requirement checks: %v\n", statErr)
		rawStats = map[string]int{}
	}
	statEarned, statErr := evalStatRequirements("data/triumphs.json", rawStats, earnedIDs)
	if statErr != nil {
		fmt.Fprintf(os.Stderr, "Warning: stat_requirement eval failed: %v\n", statErr)
	} else {
		for id := range statEarned {
			earnedIDs[id] = struct{}{}
		}
		if len(statEarned) > 0 {
			fmt.Printf("Auto-earned %d triumph(s) via stat requirements\n", len(statEarned))
		}
	}

	triumphChanged, triumphs, err := markTriumphs("data/triumphs.json", earnedIDs)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error updating triumphs: %v\n", err)
		os.Exit(1)
	}
	if triumphChanged {
		changed = true
	}

	// ── 4. Update seal progress ────────────────────────────────────────────────
	sealChanged, err := updateSeals("data/seals.json", triumphs, sealEarnedCounts)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error updating seals: %v\n", err)
		os.Exit(1)
	}
	if sealChanged {
		changed = true
	}

	// ── 5. Write GITHUB_OUTPUT ─────────────────────────────────────────────────
	if err := writeOutput(changed); err != nil {
		fmt.Fprintf(os.Stderr, "Error writing GITHUB_OUTPUT: %v\n", err)
		os.Exit(1)
	}

	if !changed {
		fmt.Println("No changes — weapon levels and triumphs are already current.")
	} else {
		fmt.Println("Compute complete.")
	}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// loadSkillLevels reads data/skill-levels.json → map[skill]level.
func loadSkillLevels(path string) (map[string]float64, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var levels map[string]float64
	if err := json.Unmarshal(raw, &levels); err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}
	return levels, nil
}

// updateWeaponLevels reads powerlevel-data.json, updates weapon levels from skillLevels,
// sets milestone_tier fields, and writes back if changed.
func updateWeaponLevels(path string, skillLevels map[string]float64) (bool, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return false, err
	}

	// Use map[string]interface{} to preserve unknown fields.
	var plData map[string]interface{}
	if err := json.Unmarshal(raw, &plData); err != nil {
		return false, fmt.Errorf("parse %s: %w", path, err)
	}

	weaponsRaw, ok := plData["weapons"]
	if !ok {
		return false, fmt.Errorf("%s: missing 'weapons' key", path)
	}
	weapons, ok := weaponsRaw.(map[string]interface{})
	if !ok {
		return false, fmt.Errorf("%s: 'weapons' is not an object", path)
	}

	changed := false
	for skill, newLevelF := range skillLevels {
		weaponRaw, exists := weapons[skill]
		if !exists {
			continue
		}
		weapon, ok := weaponRaw.(map[string]interface{})
		if !ok {
			continue
		}

		// Level update.
		currentLevel, _ := weapon["level"].(float64)
		if currentLevel != newLevelF {
			fmt.Printf("  %s: %.0f → %.0f\n", skill, currentLevel, newLevelF)
			weapon["level"] = newLevelF
			changed = true
		}

		// Milestone tier — always sync (in case thresholds changed).
		tier := data.MilestoneTier(int(newLevelF))
		currentTier, _ := weapon["milestone_tier"].(string)
		if tier == "" {
			// Below 100: remove the field if present.
			if _, has := weapon["milestone_tier"]; has {
				delete(weapon, "milestone_tier")
				changed = true
			}
		} else if currentTier != tier {
			weapon["milestone_tier"] = tier
			changed = true
		}
	}

	if !changed {
		return false, nil
	}
	return true, writeJSON(path, plData)
}

// processEvents reads the events JSONL and returns:
//   - earnedIDs: set of triumph IDs from triumph_earned events
//   - sealCounts: map of seal_id → count of seal_earned events
func processEvents(path string) (map[string]struct{}, map[string]int, error) {
	earnedIDs := make(map[string]struct{})
	sealCounts := make(map[string]int)

	f, err := os.Open(path)
	if os.IsNotExist(err) {
		return earnedIDs, sealCounts, nil
	}
	if err != nil {
		return nil, nil, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	lineno := 0
	for scanner.Scan() {
		lineno++
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		var event map[string]interface{}
		if err := json.Unmarshal([]byte(line), &event); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: line %d: %v\n", lineno, err)
			continue
		}

		eventType, _ := event["type"].(string)
		switch eventType {
		case "triumph_earned":
			tid, ok := event["triumph_id"].(string)
			if !ok || tid == "" {
				fmt.Fprintf(os.Stderr, "Warning: line %d: triumph_earned event missing triumph_id, skipping\n", lineno)
				continue
			}
			earnedIDs[tid] = struct{}{}

		case "seal_earned":
			sid, ok := event["seal_id"].(string)
			if !ok || sid == "" {
				fmt.Fprintf(os.Stderr, "Warning: line %d: seal_earned event missing seal_id, skipping\n", lineno)
				continue
			}
			sealCounts[sid]++
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, nil, fmt.Errorf("reading %s: %w", path, err)
	}
	return earnedIDs, sealCounts, nil
}

// markTriumphs reads triumphs.json, marks earned triumphs, writes back if changed.
// Returns (changed, full parsed triumphs data, error).
func markTriumphs(path string, earnedIDs map[string]struct{}) (bool, map[string]interface{}, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return false, nil, err
	}
	var triumphsData map[string]interface{}
	if err := json.Unmarshal(raw, &triumphsData); err != nil {
		return false, nil, fmt.Errorf("parse %s: %w", path, err)
	}

	if len(earnedIDs) == 0 {
		return false, triumphsData, nil
	}

	now := time.Now().UTC().Format(time.RFC3339)
	changed := false

	categories, _ := triumphsData["categories"].([]interface{})
	for _, catRaw := range categories {
		cat, ok := catRaw.(map[string]interface{})
		if !ok {
			continue
		}
		triumphs, _ := cat["triumphs"].([]interface{})
		for _, trRaw := range triumphs {
			tr, ok := trRaw.(map[string]interface{})
			if !ok {
				continue
			}
			id, _ := tr["id"].(string)
			if id == "" {
				continue
			}
			_, shouldEarn := earnedIDs[id]
			alreadyEarned, _ := tr["earned"].(bool)
			if shouldEarn && !alreadyEarned {
				tr["earned"] = true
				// Only set earned_at the first time.
				if _, hasAt := tr["earned_at"]; !hasAt {
					tr["earned_at"] = now
				}
				fmt.Printf("  Marked triumph earned: %s\n", id)
				changed = true
			}
		}
	}

	if !changed {
		return false, triumphsData, nil
	}
	return true, triumphsData, writeJSON(path, triumphsData)
}

// updateSeals reads seals.json, updates earned_triumphs/total_triumphs/earned counts,
// applies gilding logic from sealEarnedCounts, writes back if changed.
func updateSeals(path string, triumphsData map[string]interface{}, sealEarnedCounts map[string]int) (bool, error) {
	// Build set of all earned triumph IDs from triumphs data.
	allEarned := make(map[string]struct{})
	categories, _ := triumphsData["categories"].([]interface{})
	for _, catRaw := range categories {
		cat, ok := catRaw.(map[string]interface{})
		if !ok {
			continue
		}
		triumphs, _ := cat["triumphs"].([]interface{})
		for _, trRaw := range triumphs {
			tr, ok := trRaw.(map[string]interface{})
			if !ok {
				continue
			}
			earned, _ := tr["earned"].(bool)
			if !earned {
				continue
			}
			id, _ := tr["id"].(string)
			if id != "" {
				allEarned[id] = struct{}{}
			}
		}
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		return false, err
	}
	var sealsData map[string]interface{}
	if err := json.Unmarshal(raw, &sealsData); err != nil {
		return false, fmt.Errorf("parse %s: %w", path, err)
	}

	changed := false
	seals, _ := sealsData["seals"].([]interface{})
	for _, sealRaw := range seals {
		seal, ok := sealRaw.(map[string]interface{})
		if !ok {
			continue
		}
		sealID, _ := seal["id"].(string)

		// Compute triumph counts.
		requiredRaw, _ := seal["required_triumph_ids"].([]interface{})
		total := len(requiredRaw)
		earnedCount := 0
		for _, tidRaw := range requiredRaw {
			tid, _ := tidRaw.(string)
			if _, ok := allEarned[tid]; ok {
				earnedCount++
			}
		}
		isEarned := total > 0 && earnedCount >= total

		// Read current values (JSON numbers come in as float64).
		currentEarned, _ := seal["earned_triumphs"].(float64)
		currentTotal, _ := seal["total_triumphs"].(float64)
		currentIsEarned, _ := seal["earned"].(bool)

		if int(currentEarned) != earnedCount || int(currentTotal) != total || currentIsEarned != isEarned {
			fmt.Printf("  Seal %s: %d/%d triumphs earned\n", sealID, earnedCount, total)
			seal["earned_triumphs"] = earnedCount
			seal["total_triumphs"] = total
			seal["earned"] = isEarned
			changed = true
		}

		// ── Gilding logic ──────────────────────────────────────────────────────
		// gilded_count = max(0, seal_earned_event_count - 1)
		// This is additive — never decrease.
		eventCount := sealEarnedCounts[sealID]
		newGildedCount := 0
		if eventCount > 1 {
			newGildedCount = eventCount - 1
		}

		currentGildedCount := int(0)
		if v, ok := seal["gilded_count"].(float64); ok {
			currentGildedCount = int(v)
		}

		if newGildedCount > currentGildedCount {
			seal["gilded_count"] = newGildedCount
			changed = true
		}

		// masterworked: true when gilded_count >= 3.
		gildedCount := currentGildedCount
		if newGildedCount > currentGildedCount {
			gildedCount = newGildedCount
		}
		newMasterworked := gildedCount >= 3
		currentMasterworked, _ := seal["masterworked"].(bool)
		if newMasterworked && !currentMasterworked {
			seal["masterworked"] = true
			changed = true
		}
	}

	if !changed {
		return false, nil
	}
	return true, writeJSON(path, sealsData)
}

// writeOutput appends changed=true/false to $GITHUB_OUTPUT.
func writeOutput(changed bool) error {
	outputFile := os.Getenv("GITHUB_OUTPUT")
	if outputFile == "" {
		return nil
	}
	f, err := os.OpenFile(outputFile, os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()
	val := "false"
	if changed {
		val = "true"
	}
	_, err = fmt.Fprintf(f, "changed=%s\n", val)
	return err
}

// writeJSON marshals v as indented JSON and writes to path with trailing newline.
func writeJSON(path string, v interface{}) error {
	out, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal %s: %w", path, err)
	}
	out = append(out, '\n')
	return os.WriteFile(path, out, 0644)
}

// loadStatRaws reads the stats.*.raw values from powerlevel-data.json.
func loadStatRaws(path string) (map[string]int, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var doc struct {
		Stats map[string]struct {
			Raw int `json:"raw"`
		} `json:"stats"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}
	result := make(map[string]int, len(doc.Stats))
	for k, v := range doc.Stats {
		result[k] = v.Raw
	}
	return result, nil
}

// evalStatRequirements scans triumphs.json for triumphs with stat_requirement fields
// that are not already earned. Returns the set of triumph IDs that now qualify.
func evalStatRequirements(path string, rawStats map[string]int, alreadyEarned map[string]struct{}) (map[string]struct{}, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var triumphsData struct {
		Categories []struct {
			Triumphs []struct {
				ID      string `json:"id"`
				Earned  bool   `json:"earned"`
				StatReq *struct {
					Stat  string `json:"stat"`
					Value int    `json:"value"`
				} `json:"stat_requirement"`
			} `json:"triumphs"`
		} `json:"categories"`
	}
	if err := json.Unmarshal(raw, &triumphsData); err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}

	earned := make(map[string]struct{})
	for _, cat := range triumphsData.Categories {
		for _, tr := range cat.Triumphs {
			if tr.Earned {
				continue // already committed in triumphs.json
			}
			if _, inEvents := alreadyEarned[tr.ID]; inEvents {
				continue // already picked up from events
			}
			if tr.StatReq == nil {
				continue
			}
			if rawStats[tr.StatReq.Stat] >= tr.StatReq.Value {
				earned[tr.ID] = struct{}{}
				fmt.Printf("  Auto-earn via stat: %s (%s=%d >= %d)\n",
					tr.ID, tr.StatReq.Stat, rawStats[tr.StatReq.Stat], tr.StatReq.Value)
			}
		}
	}
	return earned, nil
}

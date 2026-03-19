package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPatchStatsPreservesWeapons(t *testing.T) {
	// Create a minimal powerlevel-data.json with a weapons section
	input := map[string]interface{}{
		"season": map[string]string{"name": "Test Season"},
		"weapons": map[string]interface{}{
			"workflow": map[string]interface{}{
				"weapon":      "Trustee",
				"element":     "arc",
				"level":       1,
				"aspect":      "KNOCKOUT",
				"weapon_type": "Legendary Weapon",
				"subclass":    "arc",
				"super":       "THUNDERCRASH",
				"primary":     true,
			},
		},
		"stats": map[string]interface{}{},
	}

	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "powerlevel-data.json")

	raw, err := json.MarshalIndent(input, "", "  ")
	if err != nil {
		t.Fatalf("marshal input: %v", err)
	}
	if err := os.WriteFile(path, raw, 0644); err != nil {
		t.Fatalf("write input: %v", err)
	}

	// Patch stats
	stats := map[string]StatBlock{
		"endurance": {Raw: 42, SoftCap: 200, Pinnacle: 1000, Unit: "sessions", ExportedAt: "2026-01-01T00:00:00Z"},
	}
	patchStats(tmpDir, stats)

	// Read back and verify weapons section is preserved
	result, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read result: %v", err)
	}

	var doc map[string]json.RawMessage
	if err := json.Unmarshal(result, &doc); err != nil {
		t.Fatalf("unmarshal result: %v", err)
	}

	if _, ok := doc["weapons"]; !ok {
		t.Error("weapons section missing after patch")
	}

	weaponsStr := string(doc["weapons"])
	if !strings.Contains(weaponsStr, "KNOCKOUT") {
		t.Error("aspect field 'KNOCKOUT' missing from weapons after patch")
	}
	if !strings.Contains(weaponsStr, "Trustee") {
		t.Error("weapon name 'Trustee' missing after patch")
	}

	// Verify stats were updated
	if _, ok := doc["stats"]; !ok {
		t.Error("stats section missing after patch")
	}
	var gotStats map[string]StatBlock
	if err := json.Unmarshal(doc["stats"], &gotStats); err != nil {
		t.Fatalf("unmarshal stats: %v", err)
	}
	if gotStats["endurance"].Raw != 42 {
		t.Errorf("expected endurance.raw=42, got %d", gotStats["endurance"].Raw)
	}
}

func TestURLFormat(t *testing.T) {
	url := "https://castrojo.github.io/powerlevel/"
	if !strings.HasPrefix(url, "https://") {
		t.Error("URL must be https")
	}
}

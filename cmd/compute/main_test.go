package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestProcessEventsParsesTriggers(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "events.jsonl")
	content := strings.Join([]string{
		`{"type":"triumph_earned","triumph_id":"first_light","timestamp":"2026-03-30T00:00:00Z"}`,
		`{"type":"seal_earned","seal_id":"cursebreaker","timestamp":"2026-03-30T00:00:00Z"}`,
		`{"type":"unknown_future_event","foo":"bar"}`,
	}, "\n") + "\n"
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatalf("write events: %v", err)
	}

	earned, sealCounts, err := processEvents(path)
	if err != nil {
		t.Fatalf("processEvents: %v", err)
	}

	if _, ok := earned["first_light"]; !ok {
		t.Fatalf("expected triumph_earned id first_light in earned set")
	}
	if sealCounts["cursebreaker"] != 1 {
		t.Fatalf("expected cursebreaker count 1, got %d", sealCounts["cursebreaker"])
	}
	// Unknown event types must be silently ignored (forward-compat).
	if len(earned) != 1 {
		t.Fatalf("expected exactly 1 earned triumph, got %d", len(earned))
	}
}

func TestUpdateWeaponLevelsDetectsChange(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "powerlevel-data.json")
	input := map[string]interface{}{
		"weapons": map[string]interface{}{
			"workflow": map[string]interface{}{
				"level": float64(1),
			},
		},
	}
	raw, _ := json.Marshal(input)
	if err := os.WriteFile(path, raw, 0644); err != nil {
		t.Fatalf("write input: %v", err)
	}

	changed, err := updateWeaponLevels(path, map[string]float64{"workflow": 2})
	if err != nil {
		t.Fatalf("updateWeaponLevels: %v", err)
	}
	if !changed {
		t.Fatalf("expected changed=true when weapon level increases")
	}

	// Re-run with same level — must report no change.
	changed2, err := updateWeaponLevels(path, map[string]float64{"workflow": 2})
	if err != nil {
		t.Fatalf("updateWeaponLevels (no-op): %v", err)
	}
	if changed2 {
		t.Fatalf("expected changed=false when weapon level is unchanged")
	}
}

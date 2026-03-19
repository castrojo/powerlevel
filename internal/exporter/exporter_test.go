package exporter_test

import (
	"testing"

	"github.com/castrojo/powerlevel/internal/data"
	"github.com/castrojo/powerlevel/internal/exporter"
)

func TestBuild_PowerLevelAndRank(t *testing.T) {
	pl := &data.PowerlevelData{
		Season: data.Season{Name: "Test Season"},
		Weapons: map[string]data.Weapon{
			"skill-a": {Element: "arc", Level: 40},
			"skill-b": {Element: "solar", Level: 40},
		},
	}
	stats := data.Stats{}

	got := exporter.Build(pl, stats)

	// PL = 100 + (40+40)/8 = 100 + 10 = 110
	wantPL := 110
	if got.PowerLevel != wantPL {
		t.Errorf("PowerLevel = %d, want %d", got.PowerLevel, wantPL)
	}
	if got.Rank == "" {
		t.Error("Rank should not be empty")
	}
	if got.ExportedAt == "" {
		t.Error("ExportedAt should not be empty")
	}
	if got.Season.Name != "Test Season" {
		t.Errorf("Season.Name = %q, want %q", got.Season.Name, "Test Season")
	}
}

func TestBuild_ActiveSupers_TopTwo(t *testing.T) {
	pl := &data.PowerlevelData{
		Season: data.Season{},
		Weapons: map[string]data.Weapon{
			"a1": {Element: "arc",    Level: 80},
			"a2": {Element: "arc",    Level: 80},
			"s1": {Element: "solar",  Level: 60},
			"v1": {Element: "void",   Level: 20},
			"st": {Element: "strand", Level: 10},
			"st2": {Element: "stasis", Level: 5},
		},
	}

	got := exporter.Build(pl, data.Stats{})

	if len(got.ActiveSupers) != 2 {
		t.Fatalf("ActiveSupers len = %d, want 2", len(got.ActiveSupers))
	}
	if got.ActiveSupers[0] != "arc" {
		t.Errorf("ActiveSupers[0] = %q, want %q", got.ActiveSupers[0], "arc")
	}
	if got.ActiveSupers[1] != "solar" {
		t.Errorf("ActiveSupers[1] = %q, want %q", got.ActiveSupers[1], "solar")
	}
}

func TestBuild_StatsPassthrough(t *testing.T) {
	pl := &data.PowerlevelData{Weapons: map[string]data.Weapon{}}
	stats := data.Stats{
		Endurance: data.Stat{Raw: 11, Score: 42, Label: "11 sessions"},
	}

	got := exporter.Build(pl, stats)

	if got.Stats.Endurance.Raw != 11 {
		t.Errorf("Stats.Endurance.Raw = %d, want 11", got.Stats.Endurance.Raw)
	}
}

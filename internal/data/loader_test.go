package data

import (
	"fmt"
	"testing"
)

func TestComputePL_AllOne(t *testing.T) {
	// 65 weapons all at level 1 → avg=1 → max(10, round(1*18))=18 → but capped at max(10,18)=18
	weapons := make(map[string]Weapon)
	for i := 0; i < 65; i++ {
		weapons[fmt.Sprintf("w%d", i)] = Weapon{Level: 1}
	}
	if got := ComputePL(weapons); got != 18 {
		t.Errorf("ComputePL all one: got %d, want 18", got)
	}
}

func TestComputePL_SomeValues(t *testing.T) {
	// mean(40, 60) = 50 → max(10, round(50*18)) = max(10, 900) = 900
	weapons := map[string]Weapon{
		"a": {Level: 40},
		"b": {Level: 60},
	}
	if got := ComputePL(weapons); got != 900 {
		t.Errorf("ComputePL: got %d, want 900", got)
	}
}

func TestComputePL_BelowMinimum(t *testing.T) {
	// Single weapon at level 0 → avg=0 → round(0*18)=0 → clamped to 10
	weapons := map[string]Weapon{
		"a": {Level: 0},
	}
	if got := ComputePL(weapons); got != 10 {
		t.Errorf("ComputePL zero level: got %d, want 10", got)
	}
}

func TestComputePL_Empty(t *testing.T) {
	if got := ComputePL(map[string]Weapon{}); got != 1 {
		t.Errorf("ComputePL empty: got %d, want 1", got)
	}
}

func TestGetRank(t *testing.T) {
	cases := []struct {
		pl   int
		want string
	}{
		{1, "New Light"},
		{9, "New Light"},
		{10, "Brave"},
		{50, "Veteran"},
		{90, "Gilded"},
		{100, "Mastercrafted ★"},
		{999, "Mastercrafted ★"},
	}
	for _, c := range cases {
		if got := GetRank(c.pl); got != c.want {
			t.Errorf("GetRank(%d) = %q, want %q", c.pl, got, c.want)
		}
	}
}

func TestSubclassAvg(t *testing.T) {
	weapons := map[string]Weapon{
		"a": {Element: "arc", Level: 20},
		"b": {Element: "arc", Level: 40},
		"c": {Element: "solar", Level: 60},
	}
	if got := SubclassAvg("arc", weapons); got != 30 {
		t.Errorf("SubclassAvg arc: got %d, want 30", got)
	}
	if got := SubclassAvg("void", weapons); got != 0 {
		t.Errorf("SubclassAvg void (empty): got %d, want 0", got)
	}
}

func TestStatScale(t *testing.T) {
	cases := []struct {
		raw      int
		softCap  int
		pinnacle int
		want     int
	}{
		{0, 200, 1000, 0},
		{200, 200, 1000, 75},  // exactly soft cap → 75
		{1000, 200, 1000, 100}, // at pinnacle → 100
		{5000, 200, 1000, 100}, // above pinnacle, clamped to 100
	}
	for _, c := range cases {
		got := StatScale(c.raw, c.softCap, c.pinnacle)
		if got != c.want {
			t.Errorf("StatScale(%d, %d, %d) = %d, want %d", c.raw, c.softCap, c.pinnacle, got, c.want)
		}
	}
}

func TestLevelTier(t *testing.T) {
	cases := []struct{ level int; want string }{
		{1, "New Light"},
		{9, "New Light"},
		{10, "Brave"},
		{50, "Veteran"},
		{90, "Gilded"},
		{100, "Mastercrafted ★"},
	}
	for _, c := range cases {
		if got := LevelTier(c.level); got != c.want {
			t.Errorf("LevelTier(%d) = %q, want %q", c.level, got, c.want)
		}
	}
}

func TestLoad_MissingFile(t *testing.T) {
	_, err := Load("/nonexistent/path.json")
	if err == nil {
		t.Error("Load missing file: expected error, got nil")
	}
}

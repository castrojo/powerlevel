package data

import (
	"testing"
)

func TestComputePL_AllZero(t *testing.T) {
	weapons := map[string]Weapon{
		"workflow": {Level: 0},
		"github":   {Level: 0},
	}
	if got := ComputePL(weapons); got != 100 {
		t.Errorf("ComputePL all zero: got %d, want 100", got)
	}
}

func TestComputePL_SomeValues(t *testing.T) {
	// sum = 80, PL = 100 + 80/8 = 110
	weapons := map[string]Weapon{
		"a": {Level: 40},
		"b": {Level: 40},
	}
	if got := ComputePL(weapons); got != 110 {
		t.Errorf("ComputePL: got %d, want 110", got)
	}
}

func TestGetRank(t *testing.T) {
	cases := []struct {
		pl   int
		want string
	}{
		{100, "New Light"},
		{129, "New Light"},
		{130, "Brave"},
		{250, "Veteran"},
		{450, "Gilded"},
		{650, "Mastercrafted ★"},
		{800, "Mastercrafted ★"},
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
		raw     int
		softCap int
		want    int
	}{
		{0, 200, 0},
		{200, 200, 67},  // exactly soft cap → 67
		{5000, 200, 100}, // far above soft cap, clamped to 100
	}
	for _, c := range cases {
		got := StatScale(c.raw, c.softCap)
		if got != c.want {
			t.Errorf("StatScale(%d, %d) = %d, want %d", c.raw, c.softCap, got, c.want)
		}
	}
}

func TestLevelTier(t *testing.T) {
	cases := []struct{ level int; want string }{
		{0, "Unequipped"},
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
